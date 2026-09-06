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
    nic: { type: String, required: true, unique: true, trim: true },
    phone: { type: String, default: null, trim: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
  },
  { timestamps: true, collection: 'users' }
);

module.exports = userSchema;
