const mongoose = require('mongoose');

/**
 * Collections shared with the E-Vigilance admin system (its docs/11 §3).
 * Each has one writer; this app only reads the ones the admin system owns.
 *
 *   Written by this app, read by the admin system:
 *     users, reports, report_replies, payout_requests, account_deletions
 *   Written by the admin system, read by this app:
 *     report_updates, reward_accounts, offence_schedule_public, stations
 *     (name, position and area only, to tell the citizen which police
 *     station a pin falls to)
 *
 * The admin side's own documents use the raw driver shape, so they are read
 * here through the driver too, not through Mongoose models of our own.
 */
const COLLECTIONS = Object.freeze({
  reportUpdates: 'report_updates',
  reportReplies: 'report_replies',
  rewardAccounts: 'reward_accounts',
  payoutRequests: 'payout_requests',
  accountDeletions: 'account_deletions',
  publicOffences: 'offence_schedule_public',
  stations: 'stations',
});

/** A shared collection by its key in COLLECTIONS. */
function collection(name) {
  const db = mongoose.connection.db;
  if (!db) throw new Error('The database is not connected.');
  return db.collection(COLLECTIONS[name]);
}

module.exports = { COLLECTIONS, collection };
