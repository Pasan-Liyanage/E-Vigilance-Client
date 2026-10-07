const ReportService = require('../services/reportService');
const StorageService = require('../services/storageService');

/** HTTP layer for violation reports. */
class ReportController {
  /** POST /api/reports - multipart: evidence[] + voiceNote + wizard fields. */
  create = async (req, res, next) => {
    try {
      const result = await ReportService.createReport(
        req.userId,
        req.body,
        req.files || {},
        publicBaseUrl(req)
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/reports */
  getUserReports = async (req, res, next) => {
    try {
      const { status, search, page, limit } = req.query;
      res.json(await ReportService.getUserReports(req.userId, { status, search, page, limit }));
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/reports/stats */
  getStats = async (req, res, next) => {
    try {
      res.json(await ReportService.getUserStats(req.userId));
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/reports/:id */
  getOne = async (req, res, next) => {
    try {
      res.json(await ReportService.getReportById(req.userId, req.params.id));
    } catch (err) {
      next(err);
    }
  };

  /** POST /api/uploads - a signed URL for uploading one file straight to R2. */
  presignUpload = async (req, res, next) => {
    try {
      const { name, type, size, kind } = req.body || {};
      res.json(await StorageService.presignUpload({ name, type, size, kind }));
    } catch (err) {
      next(err);
    }
  };

  /** GET /api/media/:id - streams a GridFS-stored evidence file. */
  streamMedia = async (req, res, next) => {
    try {
      await StorageService.stream(req.params.id, req, res);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/media/r2/<key> - the bucket is private, so redirect to a fresh
   * signed URL. The browser then reads (and seeks) directly from R2, which
   * keeps large videos off the serverless function.
   */
  redirectR2Media = async (req, res, next) => {
    try {
      const url = await StorageService.signedReadUrl(req.params[0]);
      // Cache the redirect for less time than the signature stays valid.
      res.setHeader('Cache-Control', 'private, max-age=1800');
      res.redirect(302, url);
    } catch (err) {
      next(err);
    }
  };
}

/** The absolute origin clients should use for media URLs. */
function publicBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return `${proto}://${req.get('host')}`;
}

module.exports = new ReportController();
