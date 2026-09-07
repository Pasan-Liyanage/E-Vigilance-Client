const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { isMediaExtension, MEDIA_EXTENSIONS } = require('../utils/mediaTypes');

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 50);

const MEDIA_PREFIXES = ['image/', 'video/', 'audio/'];

/**
 * Types that mean "the client did not tell us what this is".
 *
 * A multipart part with no Content-Type header defaults to text/plain per
 * RFC 7578, and busboy reports it that way. Several Android browsers and file
 * pickers omit the header for camera captures and gallery files, so treating
 * text/plain as a hard rejection blocks legitimate photo uploads.
 */
const UNKNOWN_TYPES = new Set([
  '',
  'text/plain',
  'application/octet-stream',
  'binary/octet-stream',
  'application/unknown',
]);

/** Bare mime type, without any ";codecs=..." parameters. */
const bareType = (mimetype) =>
  String(mimetype || '').toLowerCase().split(';')[0].trim();

/**
 * Files are kept in memory and handed straight to the storage driver,
 * so there is no uploads/ folder to manage or clean up.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 11 },
  fileFilter: (req, file, cb) => {
    const type = bareType(file.mimetype);
    const name = file.originalname || '';

    // Normal case: the browser told us and it is media.
    if (MEDIA_PREFIXES.some((p) => type.startsWith(p))) return cb(null, true);

    // The client gave us nothing useful - fall back to the file extension.
    if (UNKNOWN_TYPES.has(type)) {
      if (!name.includes('.') || isMediaExtension(name)) return cb(null, true);
      return cb(
        ApiError.badRequest(
          `"${name}" does not look like a photo, video or audio file. ` +
            `Accepted: ${MEDIA_EXTENSIONS.slice(0, 8).join(', ')} and similar.`
        )
      );
    }

    // An explicit, non-media type (application/pdf, text/html, ...).
    cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`));
  },
});

/** Accepts up to 10 photos/videos plus a single voice note. */
const reportUpload = upload.fields([
  { name: 'evidence', maxCount: 10 },
  { name: 'voiceNote', maxCount: 1 },
]);

/** Turns multer's own errors into friendly API errors. */
function handleUploadErrors(req, res, next) {
  reportUpload(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(ApiError.badRequest(`Each file must be ${MAX_MB} MB or smaller.`));
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(ApiError.badRequest('Too many files. Attach at most 10 photos or videos.'));
      }
      return next(ApiError.badRequest(err.message));
    }
    next(err);
  });
}

module.exports = { upload, reportUpload, handleUploadErrors, bareType };
