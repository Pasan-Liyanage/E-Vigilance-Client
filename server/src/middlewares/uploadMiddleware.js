const multer = require('multer');
const ApiError = require('../utils/ApiError');

const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 50);

const ALLOWED = [
  'image/', 'video/', 'audio/',
  'application/octet-stream', // some mobile browsers send this for captured media
];

/**
 * Files are kept in memory and handed straight to the storage driver,
 * so there is no uploads/ folder to manage or clean up.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 11 },
  fileFilter: (req, file, cb) => {
    const type = String(file.mimetype || '').toLowerCase();
    if (ALLOWED.some((prefix) => type.startsWith(prefix))) return cb(null, true);
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

module.exports = { upload, reportUpload, handleUploadErrors };
