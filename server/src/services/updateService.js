const mongoose = require('mongoose');
const { collection } = require('../models/shared');
const ApiError = require('../utils/ApiError');

/** The longest answer the admin system accepts (its docs/11 §7). */
const MAX_REPLY = 1000;

/**
 * What the police tell the citizen about a report (`report_updates`, written
 * by the admin system), and the citizen's answers to questions
 * (`report_replies`, written here) — admin docs/11 §5.
 */
class UpdateService {
  /** A report's updates, oldest first. @param {object} report the citizen's own report */
  async forReport(report) {
    const rows = await collection('reportUpdates')
      .find({ reportId: new mongoose.Types.ObjectId(String(report._id)) })
      .sort({ at: 1 })
      .toArray();
    return rows.map(view);
  }

  /**
   * The report's updates, and the police's open question if the latest
   * update asks one, with whether the citizen has answered it yet.
   * @param {object} report the citizen's own report
   */
  async timeline(report) {
    const updates = await this.forReport(report);
    const latest = latestStage(updates);
    if (!latest || latest.type !== 'needs_info') return { updates, question: null };
    return {
      updates,
      question: {
        text: latest.question || latest.message,
        at: latest.at,
        answered: await this.#answeredSince(report, latest.at),
      },
    };
  }

  /**
   * The citizen answers the latest question on their report. Only while the
   * report is waiting for an answer, and once per question.
   * @param {string} userId @param {object} report the citizen's own report @param {unknown} answer
   */
  async reply(userId, report, answer) {
    const text = String(answer || '').trim();
    if (text.length < 2) throw ApiError.badRequest('Write your answer first.');
    if (text.length > MAX_REPLY) {
      throw ApiError.badRequest(`Keep your answer to ${MAX_REPLY} characters.`);
    }

    const latest = latestStage(await this.forReport(report));
    if (!latest || latest.type !== 'needs_info') {
      throw ApiError.conflict('This report is not waiting for an answer.');
    }
    if (await this.#answeredSince(report, latest.at)) {
      throw ApiError.conflict('You have already answered this question.');
    }

    await collection('reportReplies').insertOne({
      reportId: new mongoose.Types.ObjectId(String(report._id)),
      userId: String(userId),
      answer: text,
      createdAt: new Date(),
    });
    return { answered: true };
  }

  /**
   * The latest stage update (not a reward line) of each report, by report id.
   * @param {string[]} reportIds
   */
  async latestFor(reportIds) {
    if (!reportIds.length) return new Map();
    const rows = await collection('reportUpdates')
      .aggregate([
        {
          $match: {
            reportId: { $in: reportIds.map((id) => new mongoose.Types.ObjectId(String(id))) },
            type: { $ne: 'reward' },
          },
        },
        { $sort: { at: -1 } },
        { $group: { _id: '$reportId', latest: { $first: '$$ROOT' } } },
      ])
      .toArray();
    return new Map(rows.map((r) => [String(r._id), view(r.latest)]));
  }

  /** Whether the citizen replied after the question asked at `askedAt`. */
  async #answeredSince(report, askedAt) {
    const count = await collection('reportReplies').countDocuments({
      reportId: new mongoose.Types.ObjectId(String(report._id)),
      createdAt: { $gte: new Date(askedAt) },
    });
    return count > 0;
  }
}

/** The latest update that moves the report on (reward lines aside). */
const latestStage = (updates) => [...updates].reverse().find((u) => u.type !== 'reward') || null;

/** The fields the app shows; written in plain words by the admin system. */
function view(u) {
  return {
    type: u.type,
    title: u.title,
    message: u.message,
    question: u.question || null,
    reportNumber: u.reportNumber || null,
    at: u.at,
  };
}

module.exports = new UpdateService();
module.exports.MAX_REPLY = MAX_REPLY;
