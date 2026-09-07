const ReportModel = require('../models/reportModel');
const StorageService = require('./storageService');
const ApiError = require('../utils/ApiError');

const REQUIRED = ['vehicleType', 'vehicleNumber', 'dateTime', 'issueType'];
const KINDS = ['image', 'video', 'audio'];
const MAX_DIRECT_ITEMS = 10;

/**
 * Media the browser uploaded straight to Cloudinary arrives as URLs rather
 * than files. Never trust those blindly: only accept https URLs on the
 * configured Cloudinary account, so a caller cannot store a link to anything
 * else in a report.
 */
function validateDirectMedia(raw, { field }) {
  if (raw === undefined || raw === null || raw === '') return [];

  let items = raw;
  if (typeof items === 'string') {
    try { items = JSON.parse(items); } catch { throw ApiError.badRequest(`${field} is not valid JSON.`); }
  }
  if (!Array.isArray(items)) items = [items];
  if (items.length > MAX_DIRECT_ITEMS) {
    throw ApiError.badRequest(`Attach at most ${MAX_DIRECT_ITEMS} photos or videos.`);
  }

  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) {
    throw ApiError.badRequest(
      'Direct uploads are not enabled on this server (CLOUDINARY_CLOUD_NAME is unset).'
    );
  }
  // https://res.cloudinary.com/<cloud>/... - the only shape we will store.
  const allowed = new RegExp(`^https://res\\.cloudinary\\.com/${cloud.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`);

  return items.map((item, i) => {
    if (!item || typeof item !== 'object') {
      throw ApiError.badRequest(`${field}[${i}] is not an object.`);
    }
    const url = String(item.url || '');
    if (!allowed.test(url)) {
      throw ApiError.badRequest(
        `${field}[${i}] must be an https URL on the configured Cloudinary account.`
      );
    }
    const kind = KINDS.includes(item.kind) ? item.kind : 'image';
    return {
      url,
      kind,
      mimeType: item.mimeType ? String(item.mimeType).slice(0, 100) : null,
      size: Number.isFinite(Number(item.size)) ? Number(item.size) : null,
      storage: 'cloudinary',
      publicId: item.publicId ? String(item.publicId).slice(0, 300) : null,
      originalName: item.originalName ? String(item.originalName).slice(0, 260) : null,
    };
  });
}

/** Business rules for creating and reading violation reports. */
class ReportService {
  /**
   * Creates a report for a user.
   * @param {string} userId
   * @param {object} body    the wizard fields
   * @param {object} files   { evidence: File[], voiceNote: File[] } from multer
   * @param {string} baseUrl absolute origin, used for GridFS media URLs
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
    //  - multipart: files stream through this API (local, Docker, Render)
    //  - JSON: the browser already uploaded to Cloudinary and sends URLs.
    //    Required on platforms that cap request bodies, such as Vercel's 4.5MB.
    const uploaded = [];
    let voiceNote = null;

    const directEvidence = validateDirectMedia(body.evidence, { field: 'evidence' });
    const directVoice = validateDirectMedia(body.voiceNote, { field: 'voiceNote' })[0] || null;

    if (directEvidence.length || directVoice) {
      uploaded.push(...directEvidence);
      if (directVoice) voiceNote = { ...directVoice, kind: 'audio' };
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
