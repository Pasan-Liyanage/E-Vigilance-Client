const mongoose = require('mongoose');
const { getBucket } = require('../config/database');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');
const { mimeFromName, extensionOf } = require('../utils/mediaTypes');

/** Types that carry no real information about the file. */
const VAGUE_TYPES = new Set([
  '', 'text/plain', 'application/octet-stream', 'binary/octet-stream', 'application/unknown',
]);

/**
 * Some browsers omit a part's Content-Type, which arrives as text/plain.
 * Storing that would later serve a photo as text, so resolve a real type from
 * the filename before anything is persisted.
 */
function normaliseMime(mimetype, filename, expectedKind) {
  const bare = String(mimetype || '').toLowerCase().split(';')[0].trim();
  if (!VAGUE_TYPES.has(bare)) return mimetype;

  const guessed = mimeFromName(filename);
  if (!guessed) return 'application/octet-stream';

  // Containers like .webm and .ogg hold either audio or video. When the caller
  // knows which field this is (a voice note, say), trust that over the guess.
  const [top, sub] = guessed.split('/');
  if (expectedKind && top !== expectedKind && ['webm', 'ogg', 'mp4'].includes(sub)) {
    return `${expectedKind}/${sub}`;
  }
  return guessed;
}

/**
 * Stores evidence media either in Cloudinary or in MongoDB GridFS.
 *
 * GridFS is the default so the system runs with nothing but the Mongo URI.
 * Adding the three CLOUDINARY_* keys switches uploads over automatically and
 * produces the same res.cloudinary.com URLs the older reports already use.
 */
class StorageService {
  /** Which driver uploads will use right now: 'cloudinary' or 'gridfs'. */
  get driver() {
    const configured = (process.env.STORAGE_DRIVER || 'auto').toLowerCase();
    if (configured === 'cloudinary') {
      if (!isCloudinaryConfigured) {
        throw new Error(
          'STORAGE_DRIVER=cloudinary but CLOUDINARY_* keys are missing in .env'
        );
      }
      return 'cloudinary';
    }
    if (configured === 'gridfs') return 'gridfs';
    return isCloudinaryConfigured ? 'cloudinary' : 'gridfs';
  }

  /**
   * Uploads one multer in-memory file.
   * @param {object} file   multer file ({ buffer, mimetype, originalname, size })
   * @param {string} baseUrl absolute origin of this API, used to build GridFS URLs
   * @param {'image'|'video'|'audio'} [expectedKind] disambiguates containers
   *   such as .webm that can hold either audio or video
   * @returns {Promise<object>} a media sub-document
   */
  async upload(file, baseUrl, expectedKind) {
    if (!file || !file.buffer) throw ApiError.badRequest('No file received.');
    file = { ...file, mimetype: normaliseMime(file.mimetype, file.originalname, expectedKind) };
    const kind = expectedKind || detectKind(file.mimetype, file.originalname);
    return this.driver === 'cloudinary'
      ? this.#toCloudinary(file, kind)
      : this.#toGridFS(file, kind, baseUrl);
  }

  /** Uploads several files, preserving order. */
  async uploadMany(files, baseUrl) {
    if (!files || !files.length) return [];
    return Promise.all(files.map((f) => this.upload(f, baseUrl)));
  }

  async #toCloudinary(file, kind) {
    const folder = process.env.CLOUDINARY_FOLDER || 'evigilance/violations';
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (err, res) => (err ? reject(err) : resolve(res))
      );
      stream.end(file.buffer);
    });

    return {
      url: result.secure_url,
      kind,
      mimeType: file.mimetype,
      size: file.size,
      storage: 'cloudinary',
      publicId: result.public_id,
      originalName: file.originalname || null,
    };
  }

  #toGridFS(file, kind, baseUrl) {
    return new Promise((resolve, reject) => {
      const bucket = getBucket();
      const filename = `${Date.now()}-${(file.originalname || 'evidence').replace(/[^\w.\-]/g, '_')}`;
      const stream = bucket.openUploadStream(filename, {
        contentType: file.mimetype,
        metadata: { kind, originalName: file.originalname || null },
      });

      stream.on('error', reject);
      stream.on('finish', () => {
        const id = String(stream.id);
        resolve({
          url: `${trimSlash(baseUrl)}/api/media/${id}`,
          kind,
          mimeType: file.mimetype,
          size: file.size,
          storage: 'gridfs',
          publicId: id,
          originalName: file.originalname || null,
        });
      });

      stream.end(file.buffer);
    });
  }

  /** Streams a GridFS file to an HTTP response, honouring Range requests. */
  async stream(fileId, req, res) {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw ApiError.badRequest('Invalid media id.');
    }
    const _id = new mongoose.Types.ObjectId(fileId);
    const bucket = getBucket();

    const [doc] = await bucket.find({ _id }).limit(1).toArray();
    if (!doc) throw ApiError.notFound('Media not found.');

    const total = doc.length;
    const type = doc.contentType || 'application/octet-stream';
    res.setHeader('Content-Type', type);
    // Never let a browser re-interpret stored evidence as something executable.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const range = req.headers.range;
    if (range) {
      // "bytes=start-end" - lets browsers seek within video and audio.
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      let start = match && match[1] ? parseInt(match[1], 10) : 0;
      let end = match && match[2] ? parseInt(match[2], 10) : total - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`);
        return res.end();
      }
      end = Math.min(end, total - 1);

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', end - start + 1);
      return bucket.openDownloadStream(_id, { start, end: end + 1 }).pipe(res);
    }

    res.setHeader('Content-Length', total);
    return bucket.openDownloadStream(_id).pipe(res);
  }

  /** Removes a stored asset. Never throws - cleanup is best-effort. */
  async remove(media) {
    try {
      if (!media || !media.publicId) return;
      if (media.storage === 'cloudinary') {
        const resourceType = media.kind === 'image' ? 'image' : 'video';
        await cloudinary.uploader.destroy(media.publicId, { resource_type: resourceType });
      } else if (mongoose.Types.ObjectId.isValid(media.publicId)) {
        await getBucket().delete(new mongoose.Types.ObjectId(media.publicId));
      }
    } catch (err) {
      console.warn('[storage] cleanup failed:', err.message);
    }
  }
}

/** Maps a mimetype (with a filename fallback) onto image | video | audio. */
function detectKind(mimetype = '', filename = '') {
  const m = String(mimetype).toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  // A vague type tells us nothing - fall through to the extension below.

  const ext = String(filename).toLowerCase().split('.').pop();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv', '3gp'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'webm', 'weba'].includes(ext)) return 'audio';
  return 'image';
}

function trimSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

module.exports = new StorageService();
module.exports.detectKind = detectKind;
module.exports.normaliseMime = normaliseMime;
