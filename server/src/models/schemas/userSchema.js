const mongoose = require('mongoose');

/**
 * Citizen account. Shares the `users` collection with the admin panel,
 * which stores its own staff accounts with `password_hash` + role hq/station.
 * Citizen accounts always carry `password` (bcrypt) and role 'user'.
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
    // Uniqueness is enforced by the partial index below, not `unique: true`:
    // a plain unique index treats every account WITHOUT a nic as null, so
    // only one such account could ever exist in the shared collection.
    nic: { type: String, required: true, trim: true },
    phone: { type: String, default: null, trim: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
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
