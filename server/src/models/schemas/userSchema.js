const mongoose = require('mongoose');

/** A one-time code sent to the citizen's phone; only its hash is kept. */
const phoneCodeSchema = new mongoose.Schema(
  {
    hash: { type: String, required: true },
    phone: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, required: true },
  },
  { _id: false }
);

/**
 * Citizen account. Shares the `users` collection with the previous admin
 * panel, which stores its own staff accounts with `password_hash` + role
 * hq/station. Citizen accounts always carry `password` (bcrypt) and role
 * 'user'.
 *
 * The new admin system reads `name`, `phone`, `nic`, `dateOfBirth`,
 * `phoneVerified` and `nicVerified` to decide reward eligibility
 * (its docs/11 §6 and docs/16 §3).
 */
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Canonical form (utils/srilanka.js). Uniqueness is enforced by the
    // partial index below, not `unique: true`: a plain unique index treats
    // every account WITHOUT a nic as null, so only one such account (or one
    // deleted account) could ever exist in the shared collection.
    nic: { type: String, default: null, trim: true },
    // +94 and the 9-digit national number.
    phone: { type: String, default: null, trim: true },
    dateOfBirth: { type: Date, default: null },
    // Set when the citizen enters the one-time code sent to `phone`.
    phoneVerified: { type: Boolean, default: false },
    // Set when the NIC is well formed and encodes the date of birth given.
    nicVerified: { type: Boolean, default: false },
    phoneCode: { type: phoneCodeSchema, default: null },
    // Null once the account is deleted.
    password: { type: String, default: null },
    role: { type: String, default: 'user' },
    // The citizen deleted their account (the admin system's docs/10 §5.5).
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'users' }
);

// Unique only among accounts that actually have a NIC. Named differently from
// the old `nic_1` so the two can't clash; run scripts/migrate-nic-index.js
// once to drop `nic_1`.
userSchema.index(
  { nic: 1 },
  { name: 'nic_unique_when_set', unique: true, partialFilterExpression: { nic: { $type: 'string' } } }
);

module.exports = userSchema;
