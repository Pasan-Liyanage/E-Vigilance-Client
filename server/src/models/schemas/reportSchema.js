const mongoose = require('mongoose');

/** One uploaded evidence item (photo, video or voice note). */
const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    kind: { type: String, enum: ['image', 'video', 'audio'], required: true },
    mimeType: { type: String, default: null },
    size: { type: Number, default: null },
    storage: { type: String, enum: ['r2', 'gridfs', 'cloudinary'], required: true },
    // R2: the object key (evidence/images/<fileName>) and the stored file name.
    key: { type: String, default: null },
    fileName: { type: String, default: null },
    publicId: { type: String, default: null },
    originalName: { type: String, default: null },
    // Recorded with the app's camera or recorder (true) or picked from the
    // gallery (false); triage sees the difference (admin docs/11 D11-4).
    capturedInApp: { type: Boolean, default: null },
    capturedAt: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * A citizen-submitted violation report, imported by the admin system
 * (its docs/11 §4).
 *
 * The contract fields are `clientReportId`, `offenceIds`, `occurredAt`,
 * `injuries` and `description`. The older fields (`dateTime`, `issueType`,
 * `additionalDetails`, `evidencePath`, `status`) are still written so the
 * previous admin panel keeps working during the change-over.
 */
const reportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Unique per citizen and report, generated when the report is started:
    // a report sent twice (a retry, a double tap) is stored once.
    clientReportId: { type: String, default: null },

    // Legacy-compatible: the primary evidence URL the previous admin panel displays.
    evidencePath: { type: String, default: null },

    // Many photos/videos plus an optional voice note.
    evidence: { type: [mediaSchema], default: [] },
    voiceNote: { type: mediaSchema, default: null },

    vehicleType: { type: String, required: true },
    vehicleNumber: { type: String, required: true, uppercase: true, trim: true },
    vehicleModel: { type: String, default: null },

    // Offence codes from the published schedule (`offence_schedule_public`).
    offenceIds: { type: [String], default: [] },
    // The offences' names, for the previous admin panel and for search.
    issueType: { type: String, required: true },
    // Someone was hurt: the admin system triages the report first (P1).
    injuries: { type: Boolean, default: false },

    occurredAt: { type: Date, default: null },
    dateTime: { type: Date, required: true },

    location: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    description: { type: String, default: null },
    additionalDetails: { type: String, default: null },

    // Kept current by the admin system during the change-over; citizens see
    // the fuller timeline from `report_updates`.
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
reportSchema.index(
  { userId: 1, clientReportId: 1 },
  { name: 'client_report_unique', unique: true, partialFilterExpression: { clientReportId: { $type: 'string' } } }
);

module.exports = reportSchema;
