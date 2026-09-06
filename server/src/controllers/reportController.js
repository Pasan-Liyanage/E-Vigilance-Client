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

  /** GET /api/media/:id - streams a GridFS-stored evidence file. */
  streamMedia = async (req, res, next) => {
    try {
      await StorageService.stream(req.params.id, req, res);
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
