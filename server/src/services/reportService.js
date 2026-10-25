const ReportModel = require('../models/reportModel');
const StorageService = require('./storageService');
const OffenceService = require('./offenceService');
const UpdateService = require('./updateService');
const RewardService = require('./rewardService');
const MediaAccess = require('./mediaAccess');
const ApiError = require('../utils/ApiError');
const { extractCoordinates } = require('../utils/coordinates');
const { insideSriLanka, colomboDayStart } = require('../utils/srilanka');

const REQUIRED = ['vehicleType', 'vehicleNumber'];
const MAX_DIRECT_ITEMS = 10;

/** The admin system's rules for a citizen report (its docs/11 §4, §7). */
const MAX_AGE_DAYS = 30;
const DAILY_LIMIT = 20;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 2000;
/** Per-kind size limits (admin docs/11 §4); videos are also capped by MAX_UPLOAD_MB. */
const KIND_LIMIT_MB = { image: 25, video: 500, audio: 100 };
/** How a pin was set (admin docs/11 §4). */
const LOCATION_SOURCES = ['gps', 'photo', 'map', 'link', 'coordinates'];

/**
 * Media the browser uploaded straight to R2 arrives as object keys rather
 * than files. Never trust those blindly: each key must match the layout we
 * hand out, and R2 must confirm the object exists, so a caller cannot attach
 * anything else to a report.
 */
async function validateDirectMedia(raw, { field, baseUrl }) {
  const items = parseList(raw, field);
  if (items.length > MAX_DIRECT_ITEMS) {
    throw ApiError.badRequest(`Attach at most ${MAX_DIRECT_ITEMS} photos or videos.`);
  }
  if (!items.length) return [];

  if (!StorageService.directUploadEnabled) {
    throw ApiError.badRequest('Direct uploads are not enabled on this server (R2 is not configured).');
  }

  return Promise.all(items.map(async (item, i) => {
    if (!item || typeof item !== 'object') {
      throw ApiError.badRequest(`${field}[${i}] is not an object.`);
    }
    const media = await StorageService.confirmUpload(item, baseUrl, `${field}[${i}]`);
    return withCapture(media, item);
  }));
}

/** A JSON list from a JSON body or a multipart text field. */
function parseList(raw, field) {
  if (raw === undefined || raw === null || raw === '') return [];
  let items = raw;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { throw ApiError.badRequest(`${field} is not valid JSON.`); }
  }
  return Array.isArray(items) ? items : [items];
}

/**
 * Whether the file was recorded with the app's camera or recorder, and when
 * (admin docs/11 D11-4). Files from the gallery are marked `false`.
 */
function withCapture(media, meta = {}) {
  const at = meta.capturedAt ? new Date(meta.capturedAt) : null;
  return {
    ...media,
    capturedInApp: meta.capturedInApp === true || meta.capturedInApp === 'true',
    capturedAt: at && !Number.isNaN(at.getTime()) ? at : null,
  };
}

/** Business rules for creating and reading violation reports. */
class ReportService {
  /**
   * Creates a report for a user.
   * @param {string} userId
   * @param {object} body    the wizard fields
   * @param {object} files   { evidence: File[], voiceNote: File[] } from multer
   * @param {string} baseUrl absolute origin, used to build media URLs
   * @returns {{ report: object, duplicate: boolean }}
   */
  async createReport(userId, body, files = {}, baseUrl = '') {
    // A report sent twice is stored once (admin docs/11 §4).
    const clientReportId = nullable(body.clientReportId)?.slice(0, 100) || null;
    if (clientReportId) {
      const existing = await ReportModel.findByClientId(userId, clientReportId);
      if (existing) return { report: this.#forOwner(existing), duplicate: true };
    }

    if (await RewardService.isSuspended(userId)) {
      throw ApiError.forbidden(
        'Your account is suspended from sending reports. Contact the police if you think this is a mistake.'
      );
    }

    const missing = REQUIRED.filter((f) => !String(body[f] || '').trim());
    if (missing.length) {
      throw ApiError.badRequest(`Missing required field(s): ${missing.join(', ')}.`);
    }

    // Offences from the published schedule. Builds of the app from before
    // the schedule existed still send `issueType` text, which the admin
    // system matches as well as it can (its docs/11 §9).
    const contract = Array.isArray(body.offenceIds) || typeof body.offenceIds === 'string';
    let offences = null;
    if (contract) {
      offences = await OffenceService.resolve(parseList(body.offenceIds, 'offenceIds'), body.vehicleType);
    } else if (!String(body.issueType || '').trim()) {
      throw ApiError.badRequest('Choose what the driver did.');
    }

    const when = new Date(body.occurredAt || body.dateTime);
    if (Number.isNaN(when.getTime())) {
      throw ApiError.badRequest('The violation date and time is not valid.');
    }
    if (when.getTime() > Date.now() + 5 * 60 * 1000) {
      throw ApiError.badRequest('The violation date and time cannot be in the future.');
    }
    if (Date.now() - when.getTime() > MAX_AGE_DAYS * 24 * 3600 * 1000) {
      throw ApiError.badRequest(
        `Reports must be about something that happened in the last ${MAX_AGE_DAYS} days.`
      );
    }

    const description = nullable(body.description ?? body.additionalDetails);
    if (contract && (!description || description.length < DESCRIPTION_MIN)) {
      throw ApiError.badRequest(
        `Describe what happened in at least ${DESCRIPTION_MIN} characters.`
      );
    }
    if (description && description.length > DESCRIPTION_MAX) {
      throw ApiError.badRequest(`Keep the description to ${DESCRIPTION_MAX} characters.`);
    }

    let latitude = numberOrNull(body.latitude);
    let longitude = numberOrNull(body.longitude);
    if (latitude == null || longitude == null) {
      const typed = extractCoordinates(body.location);
      if (typed) ({ latitude, longitude } = typed);
    }
    if (contract && (latitude == null || longitude == null)) {
      throw ApiError.badRequest('Pin the place on the map, or use your current location.');
    }
    if (latitude != null && longitude != null && !insideSriLanka(latitude, longitude)) {
      throw ApiError.badRequest('The place must be in Sri Lanka.');
    }
    // The pin chooses the police station, so the citizen must have checked
    // it on the map, however it was set.
    if (contract && !(body.locationConfirmed === true || body.locationConfirmed === 'true')) {
      throw ApiError.badRequest('Check the pin on the map and confirm it is exactly where it happened.');
    }
    const locationSource = LOCATION_SOURCES.includes(body.locationSource) ? body.locationSource : null;
    const accuracy = numberOrNull(body.locationAccuracy);
    const locationAccuracy =
      locationSource === 'gps' && accuracy != null && accuracy >= 0 ? Math.round(accuracy) : null;

    if ((await ReportModel.countSince(userId, colomboDayStart())) >= DAILY_LIMIT) {
      throw new ApiError(
        429,
        `You have sent ${DAILY_LIMIT} reports today, the most allowed in a day. Please try again tomorrow.`
      );
    }

    const { uploaded, voiceNote } = await this.#storeMedia(body, files, baseUrl);
    const primary = uploaded.find((m) => m.kind === 'image') || uploaded[0] || null;
    const names = offences ? offences.map((o) => o.name).join('; ') : String(body.issueType).trim();

    let report;
    try {
      report = await ReportModel.createReport({
        userId,
        clientReportId,
        // Keeps the previous admin panel's single-image field populated.
        evidencePath: primary ? primary.url : null,
        evidence: uploaded,
        voiceNote,
        vehicleType: String(body.vehicleType).trim(),
        vehicleNumber: String(body.vehicleNumber).trim(),
        vehicleModel: nullable(body.vehicleModel),
        offenceIds: offences ? offences.map((o) => o.code) : [],
        issueType: names,
        injuries: body.injuries === true || body.injuries === 'true',
        occurredAt: when,
        dateTime: when,
        location: nullable(body.location),
        latitude,
        longitude,
        locationSource,
        locationAccuracy,
        description,
        additionalDetails: description,
        status: 'In Progress',
      });
    } catch (err) {
      // The same report arrived twice at once: keep the first, drop this copy's files.
      if (err?.code === 11000 && clientReportId) {
        await Promise.all([...uploaded, voiceNote].filter(Boolean).map((m) => StorageService.remove(m)));
        const existing = await ReportModel.findByClientId(userId, clientReportId);
        if (existing) return { report: this.#forOwner(existing), duplicate: true };
      }
      throw err;
    }

    return { report: this.#forOwner(report.toObject()), duplicate: false };
  }

  /**
   * Stores the evidence by either path:
   *  - JSON: the browser already uploaded to R2 and sends object keys, each
   *    with its capture details (needed where request bodies are capped,
   *    such as Vercel's 4.5MB);
   *  - multipart: files stream through this API, with their capture details
   *    in `evidenceMeta`, in the same order.
   */
  async #storeMedia(body, files, baseUrl) {
    const uploaded = [];
    let voiceNote = null;

    const directEvidence = await validateDirectMedia(body.evidence, { field: 'evidence', baseUrl });
    const directVoice =
      (await validateDirectMedia(body.voiceNote, { field: 'voiceNote', baseUrl }))[0] || null;
    if (directVoice && directVoice.kind !== 'audio') {
      throw ApiError.badRequest('voiceNote must be an audio file.');
    }

    if (directEvidence.length || directVoice) {
      uploaded.push(...directEvidence);
      voiceNote = directVoice;
    } else {
      const meta = parseList(body.evidenceMeta, 'evidenceMeta');
      try {
        const evidenceFiles = files.evidence || [];
        for (const [i, file] of evidenceFiles.entries()) {
          uploaded.push(withCapture(await StorageService.upload(file, baseUrl), meta[i]));
        }
        if (files.voiceNote && files.voiceNote[0]) {
          voiceNote = withCapture(
            await StorageService.upload(files.voiceNote[0], baseUrl, 'audio'),
            { capturedInApp: true }
          );
        }
      } catch (err) {
        await Promise.all(
          [...uploaded, voiceNote].filter(Boolean).map((m) => StorageService.remove(m))
        );
        throw new ApiError(502, `Uploading your evidence failed: ${err.message}`);
      }
    }

    const tooLarge = [...uploaded, voiceNote].find(
      (m) => m && m.size && m.size > KIND_LIMIT_MB[m.kind] * 1024 * 1024
    );
    if (tooLarge) {
      await Promise.all([...uploaded, voiceNote].filter(Boolean).map((m) => StorageService.remove(m)));
      throw ApiError.badRequest(
        `Each ${tooLarge.kind === 'image' ? 'photo' : tooLarge.kind} must be ${KIND_LIMIT_MB[tooLarge.kind]} MB or smaller.`
      );
    }
    return { uploaded, voiceNote };
  }

  /**
   * Lists the signed-in user's reports, each with its latest update from the
   * police. `stage` filters: waiting (a question to answer), review, closed.
   */
  async getUserReports(userId, options) {
    const { reports, total } = await ReportModel.getUserReports(userId, options);
    const latest = await UpdateService.latestFor(reports.map((r) => r._id));
    return {
      message: 'Reports retrieved successfully',
      count: reports.length,
      total,
      reports: reports.map((r) => ({ ...this.#forOwner(r), latestUpdate: latest.get(r._id) || null })),
    };
  }

  /** Fetches one report, enforcing ownership. */
  async getReportById(userId, reportId) {
    const report = await this.ownReport(userId, reportId);
    return { message: 'Report retrieved successfully', report: this.#forOwner(report) };
  }

  /** The report if it belongs to the user; 404 or 403 otherwise. */
  async ownReport(userId, reportId) {
    const report = await ReportModel.getReportById(reportId);
    if (!report) throw ApiError.notFound('Report not found.');
    if (String(report.userId) !== String(userId)) {
      throw ApiError.forbidden('You do not have access to this report.');
    }
    return report;
  }

  /** Dashboard counters for the signed-in user, by stage. */
  async getUserStats(userId) {
    const stats = await ReportModel.getUserStats(userId);
    return { message: 'Stats retrieved successfully', stats };
  }

  /** The report as its owner sees it: media links usable from the browser. */
  #forOwner(report) {
    const media = (m) => (m ? { ...m, url: MediaAccess.link(m.url) } : m);
    return {
      ...report,
      _id: String(report._id),
      userId: String(report.userId),
      evidencePath: MediaAccess.link(report.evidencePath),
      evidence: (report.evidence || []).map(media),
      voiceNote: media(report.voiceNote),
    };
  }
}

const nullable = (v) => {
  const s = String(v ?? '').trim();
  return s === '' || s === 'null' || s === 'undefined' ? null : s;
};

const numberOrNull = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

module.exports = new ReportService();
