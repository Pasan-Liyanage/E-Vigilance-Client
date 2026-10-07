const ReportModel = require('../models/reportModel');
const StorageService = require('./storageService');
const ApiError = require('../utils/ApiError');

const REQUIRED = ['vehicleType', 'vehicleNumber', 'dateTime', 'issueType'];
const MAX_DIRECT_ITEMS = 10;

/**
 * Media the browser uploaded straight to R2 arrives as object keys rather
 * than files. Never trust those blindly: each key must match the layout we
 * hand out, and R2 must confirm the object exists, so a caller cannot attach
 * anything else to a report.
 */
async function validateDirectMedia(raw, { field, baseUrl }) {
  if (raw === undefined || raw === null || raw === '') return [];

  let items = raw;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { throw ApiError.badRequest(`${field} is not valid JSON.`); }
  }
  if (!Array.isArray(items)) items = [items];
  if (items.length > MAX_DIRECT_ITEMS) {
    throw ApiError.badRequest(`Attach at most ${MAX_DIRECT_ITEMS} photos or videos.`);
  }
  if (!items.length) return [];

  if (!StorageService.directUploadEnabled) {
    throw ApiError.badRequest('Direct uploads are not enabled on this server (R2 is not configured).');
  }

  return Promise.all(items.map((item, i) => {
    if (!item || typeof item !== 'object') {
      throw ApiError.badRequest(`${field}[${i}] is not an object.`);
    }
    return StorageService.confirmUpload(item, baseUrl, `${field}[${i}]`);
  }));
}

/** Business rules for creating and reading violation reports. */
class ReportService {
  /**
   * Creates a report for a user.
   * @param {string} userId
   * @param {object} body    the wizard fields
   * @param {object} files   { evidence: File[], voiceNote: File[] } from multer
   * @param {string} baseUrl absolute origin, used to build media URLs
   */
  async createReport(userId, body, files = {}, baseUrl = '') {
    const missing = REQUIRED.filter((f) => !String(body[f] || '').trim());
    if (missing.length) {
      throw ApiError.badRequest(`Missing required field(s): ${missing.join(', ')}.`);
    }

    const when = new Date(body.dateTime);
    if (Number.isNaN(when.getTime())) {
      throw ApiError.badRequest('The violation date and time is not valid.');
    }
    if (when.getTime() > Date.now() + 5 * 60 * 1000) {
      throw ApiError.badRequest('The violation date and time cannot be in the future.');
    }

    // Two submission paths:
    //  - multipart: files stream through this API into storage
    //  - JSON: the browser already uploaded to R2 and sends object keys.
    //    Required on platforms that cap request bodies, such as Vercel's 4.5MB.
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
      try {
        const evidenceFiles = files.evidence || [];
        for (const file of evidenceFiles) {
          uploaded.push(await StorageService.upload(file, baseUrl));
        }
        if (files.voiceNote && files.voiceNote[0]) {
          voiceNote = await StorageService.upload(files.voiceNote[0], baseUrl, 'audio');
        }
      } catch (err) {
        await Promise.all(
          [...uploaded, voiceNote].filter(Boolean).map((m) => StorageService.remove(m))
        );
        throw new ApiError(502, `Uploading your evidence failed: ${err.message}`);
      }
    }

    const primary = uploaded.find((m) => m.kind === 'image') || uploaded[0] || null;

    const report = await ReportModel.createReport({
      userId,
      // Keeps the admin panel's existing single-image field populated.
      evidencePath: primary ? primary.url : null,
      evidence: uploaded,
      voiceNote,
      vehicleType: String(body.vehicleType).trim(),
      vehicleNumber: String(body.vehicleNumber).trim(),
      vehicleModel: nullable(body.vehicleModel),
      dateTime: when,
      issueType: String(body.issueType).trim(),
      location: nullable(body.location),
      latitude: numberOrNull(body.latitude),
      longitude: numberOrNull(body.longitude),
      additionalDetails: nullable(body.additionalDetails),
      status: 'In Progress',
    });

    return { message: 'Report submitted successfully', report: report.toObject() };
  }

  /** Lists the signed-in user's reports. */
  async getUserReports(userId, options) {
    const { reports, total } = await ReportModel.getUserReports(userId, options);
    return { message: 'Reports retrieved successfully', count: reports.length, total, reports };
  }

  /** Fetches one report, enforcing ownership. */
  async getReportById(userId, reportId) {
    const report = await ReportModel.getReportById(reportId);
    if (!report) throw ApiError.notFound('Report not found.');
    if (String(report.userId) !== String(userId)) {
      throw ApiError.forbidden('You do not have access to this report.');
    }
    return { message: 'Report retrieved successfully', report };
  }

  /** Dashboard counters for the signed-in user. */
  async getUserStats(userId) {
    const stats = await ReportModel.getUserStats(userId);
    return { message: 'Stats retrieved successfully', stats };
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
