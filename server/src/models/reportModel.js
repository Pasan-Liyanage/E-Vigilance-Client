const mongoose = require('mongoose');
const reportSchema = require('./schemas/reportSchema');

const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);

/** Data-access layer for violation reports. */
class ReportModel {
  /** Saves a new report and returns it. */
  async createReport(reportData) {
    const report = new Report(reportData);
    await report.save();
    return report;
  }

  /**
   * Lists one user's reports, newest first.
   * Supports optional status filter, free-text search and pagination.
   */
  async getUserReports(userId, { status, search, page = 1, limit = 50 } = {}) {
    const query = { userId };
    if (status && status !== 'All') query.status = status;
    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { vehicleNumber: rx },
        { issueType: rx },
        { location: rx },
        { additionalDetails: rx },
        { vehicleModel: rx },
      ];
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const [reports, total] = await Promise.all([
      Report.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Report.countDocuments(query),
    ]);

    return { reports: reports.map(normalise), total };
  }

  /** Fetches a single report by id. */
  async getReportById(reportId) {
    if (!mongoose.Types.ObjectId.isValid(reportId)) return null;
    const report = await Report.findById(reportId).lean();
    return report ? normalise(report) : null;
  }

  /** Per-status counts for a user's dashboard. */
  async getUserStats(userId) {
    const rows = await Report.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const by = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const completed = by['Completed'] || 0;
    const inProgress = by['In Progress'] || 0;
    const rejected = by['Rejected'] || 0;

    return {
      total: completed + inProgress + rejected,
      completed,
      inProgress,
      rejected,
    };
  }

  /** All reports, newest first (admin-side helper). */
  async getAllReports() {
    const reports = await Report.find({}).sort({ createdAt: -1 }).lean();
    return reports.map(normalise);
  }
}

/** Converts ObjectIds to strings so the API returns clean JSON. */
function normalise(report) {
  return {
    ...report,
    _id: String(report._id),
    userId: String(report.userId),
  };
}

module.exports = new ReportModel();
module.exports.Report = Report;
