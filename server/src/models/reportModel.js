const mongoose = require('mongoose');
const reportSchema = require('./schemas/reportSchema');
const { COLLECTIONS } = require('./shared');

const Report = mongoose.models.Report || mongoose.model('Report', reportSchema);

/** Report stages as the citizen sees them, from the police's latest update. */
const STAGES = ['waiting', 'review', 'closed'];
const CLOSED_TYPES = ['action_taken', 'closed_no_action', 'rejected'];

/**
 * Adds `stage` to each report: `waiting` when the police asked a question,
 * `closed` once they finished, `review` otherwise. Taken from the latest
 * `report_updates` entry (reward lines aside); reports from before the admin
 * system wrote updates fall back to their three-value status.
 */
const withStage = [
  {
    $lookup: {
      from: COLLECTIONS.reportUpdates,
      let: { id: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$reportId', '$$id'] }, type: { $ne: 'reward' } } },
        { $sort: { at: -1 } },
        { $limit: 1 },
        { $project: { _id: 0, type: 1 } },
      ],
      as: 'latestStage',
    },
  },
  { $addFields: { latestType: { $first: '$latestStage.type' } } },
  {
    $addFields: {
      stage: {
        $switch: {
          branches: [
            { case: { $eq: ['$latestType', 'needs_info'] }, then: 'waiting' },
            { case: { $in: ['$latestType', CLOSED_TYPES] }, then: 'closed' },
            {
              case: {
                $and: [
                  { $eq: [{ $ifNull: ['$latestType', null] }, null] },
                  { $in: ['$status', ['Completed', 'Rejected']] },
                ],
              },
              then: 'closed',
            },
          ],
          default: 'review',
        },
      },
    },
  },
  { $project: { latestStage: 0, latestType: 0 } },
];

/** Data-access layer for violation reports. */
class ReportModel {
  /** Saves a new report and returns it. */
  async createReport(reportData) {
    const report = new Report(reportData);
    await report.save();
    return report;
  }

  /** A user's report by the id their device gave it, or null. */
  async findByClientId(userId, clientReportId) {
    const report = await Report.findOne({ userId, clientReportId }).lean();
    return report ? normalise(report) : null;
  }

  /** How many reports a user sent since a moment (the daily limit). */
  async countSince(userId, since) {
    return Report.countDocuments({ userId, createdAt: { $gte: since } });
  }

  /**
   * Lists one user's reports, newest first, each with its stage.
   * Supports an optional stage filter, free-text search and pagination.
   */
  async getUserReports(userId, { stage, search, page = 1, limit = 50 } = {}) {
    const match = { userId: new mongoose.Types.ObjectId(String(userId)) };
    if (search) {
      const rx = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      match.$or = [
        { vehicleNumber: rx },
        { issueType: rx },
        { location: rx },
        { description: rx },
        { additionalDetails: rx },
        { vehicleModel: rx },
      ];
    }

    const size = Math.min(100, Math.max(1, Number(limit) || 50));
    const skip = (Math.max(1, Number(page) || 1) - 1) * size;
    const [result] = await Report.aggregate([
      { $match: match },
      ...withStage,
      ...(STAGES.includes(stage) ? [{ $match: { stage } }] : []),
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          reports: [{ $skip: skip }, { $limit: size }],
          total: [{ $count: 'n' }],
        },
      },
    ]);

    return { reports: result.reports.map(normalise), total: result.total[0]?.n || 0 };
  }

  /** Fetches a single report by id, with its stage. */
  async getReportById(reportId) {
    if (!mongoose.Types.ObjectId.isValid(reportId)) return null;
    const [report] = await Report.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(String(reportId)) } },
      ...withStage,
    ]);
    return report ? normalise(report) : null;
  }

  /** Per-stage counts for a user's dashboard. */
  async getUserStats(userId) {
    const rows = await Report.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
      ...withStage,
      { $group: { _id: '$stage', count: { $sum: 1 } } },
    ]);

    const by = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const waiting = by.waiting || 0;
    const review = by.review || 0;
    const closed = by.closed || 0;
    return { total: waiting + review + closed, waiting, review, closed };
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
module.exports.STAGES = STAGES;
