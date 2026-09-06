const mongoose = require('mongoose');

/** One uploaded evidence item (photo, video or voice note). */
const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    kind: { type: String, enum: ['image', 'video', 'audio'], required: true },
    mimeType: { type: String, default: null },
    size: { type: Number, default: null },
    storage: { type: String, enum: ['cloudinary', 'gridfs'], required: true },
    publicId: { type: String, default: null },
    originalName: { type: String, default: null },
  },
  { _id: false }
);

/**
 * A citizen-submitted violation report.
 * The first six fields keep the exact shape the existing admin panel reads,
 * so old and new reports render identically there. `evidence` / `voiceNote`
 * are additive and hold the PWA's multi-media uploads.
 */
const reportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Legacy-compatible: the primary evidence URL the admin panel already displays.
    evidencePath: { type: String, default: null },

    // PWA additions - many photos/videos plus an optional voice note.
    evidence: { type: [mediaSchema], default: [] },
    voiceNote: { type: mediaSchema, default: null },

    vehicleType: { type: String, required: true },
    vehicleNumber: { type: String, required: true, uppercase: true, trim: true },
    vehicleModel: { type: String, default: null },

    dateTime: { type: Date, required: true },
    issueType: { type: String, required: true },

    location: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    additionalDetails: { type: String, default: null },

    status: {
      type: String,
      enum: ['In Progress', 'Completed', 'Rejected'],
      default: 'In Progress',
      index: true,
    },
  },
  { timestamps: true, collection: 'reports' }
);

reportSchema.index({ userId: 1, createdAt: -1 });

module.exports = reportSchema;
