const crypto = require('crypto');
const mongoose = require('mongoose');
const {
  PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getBucket } = require('../config/database');
const { r2, isR2Configured, bucket, prefix, FOLDERS } = require('../config/r2');
const ApiError = require('../utils/ApiError');
const { EXTENSION_MIME, mimeFromName, extensionOf } = require('../utils/mediaTypes');

const MAX_BYTES = Number(process.env.MAX_UPLOAD_MB || 50) * 1024 * 1024;

/** How long a browser has to finish a direct upload once it is granted. */
const UPLOAD_URL_TTL = 15 * 60;
/** How long a signed read URL stays valid. Media links are re-signed per request. */
const READ_URL_TTL = 60 * 60;

/** Types that carry no real information about the file. */
const VAGUE_TYPES = new Set([
  '', 'text/plain', 'application/octet-stream', 'binary/octet-stream', 'application/unknown',
]);

const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** evidence/<images|videos|audios>/<file name> - the only keys we hand out or accept. */
const KEY_PATTERN = new RegExp(
  `^${escapeRx(prefix)}/(${Object.values(FOLDERS).join('|')})/([A-Za-z0-9][A-Za-z0-9._-]{0,200})$`
);
const KIND_BY_FOLDER = Object.fromEntries(Object.entries(FOLDERS).map(([k, f]) => [f, k]));

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
 * Stores evidence media either in Cloudflare R2 or in MongoDB GridFS.
 *
 * R2 is used whenever its credentials are present. Files land in
 * evidence/images, evidence/videos or evidence/audios, and the report keeps
 * the object key and file name. GridFS remains as a zero-setup fallback for
 * local development.
 */
class StorageService {
  /** Which driver uploads will use right now: 'r2' or 'gridfs'. */
  get driver() {
    const configured = (process.env.STORAGE_DRIVER || 'auto').toLowerCase();
    if (configured === 'r2') {
      if (!isR2Configured) {
        throw new Error('STORAGE_DRIVER=r2 but R2_* keys are missing in .env');
      }
      return 'r2';
    }
    if (configured === 'gridfs') return 'gridfs';
    return isR2Configured ? 'r2' : 'gridfs';
  }

  /** True when browsers may upload straight to the bucket. */
  get directUploadEnabled() {
    return this.driver === 'r2';
  }

  /**
   * Uploads one multer in-memory file.
   * @param {object} file   multer file ({ buffer, mimetype, originalname, size })
   * @param {string} baseUrl absolute origin of this API, used to build media URLs
   * @param {'image'|'video'|'audio'} [expectedKind] disambiguates containers
   *   such as .webm that can hold either audio or video
   * @returns {Promise<object>} a media sub-document
   */
  async upload(file, baseUrl, expectedKind) {
    if (!file || !file.buffer) throw ApiError.badRequest('No file received.');
    file = { ...file, mimetype: normaliseMime(file.mimetype, file.originalname, expectedKind) };
    const kind = expectedKind || detectKind(file.mimetype, file.originalname);
    return this.driver === 'r2'
      ? this.#toR2(file, kind, baseUrl)
      : this.#toGridFS(file, kind, baseUrl);
  }

  /** Uploads several files, preserving order. */
  async uploadMany(files, baseUrl) {
    if (!files || !files.length) return [];
    return Promise.all(files.map((f) => this.upload(f, baseUrl)));
  }

  async #toR2(file, kind, baseUrl) {
    const { key, fileName } = newObjectKey(kind, file.mimetype, file.originalname);
    await r2.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));
    return r2Media({ key, fileName, kind, mimeType: file.mimetype, size: file.size,
      originalName: file.originalname, baseUrl });
  }

  /**
   * Grants the browser a short-lived URL to PUT one file straight into R2,
   * so media never passes through the API (Vercel caps bodies at 4.5 MB).
   * The browser must send exactly the returned contentType.
   */
  async presignUpload({ name, type, size, kind }) {
    if (!this.directUploadEnabled) {
      throw new ApiError(501, 'Direct uploads are not enabled on this server.');
    }
    const expectedKind = Object.prototype.hasOwnProperty.call(FOLDERS, kind) ? kind : undefined;
    const contentType = normaliseMime(type, name, expectedKind);
    const bare = contentType.toLowerCase().split(';')[0].trim();
    if (!/^(image|video|audio)\//.test(bare)) {
      throw ApiError.badRequest(`"${name || 'file'}" is not a photo, video or audio file.`);
    }
    const bytes = Number(size);
    if (Number.isFinite(bytes) && bytes > MAX_BYTES) {
      throw ApiError.badRequest(`Each file must be ${MAX_BYTES / 1024 / 1024} MB or smaller.`);
    }

    const finalKind = expectedKind || detectKind(contentType, name);
    const { key, fileName } = newObjectKey(finalKind, contentType, name);
    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: UPLOAD_URL_TTL }
    );
    return { key, fileName, kind: finalKind, contentType, uploadUrl, expiresIn: UPLOAD_URL_TTL };
  }

  /**
   * Turns a key the browser reports as uploaded into a media sub-document,
   * after checking with R2 that the object really exists and is in bounds.
   */
  async confirmUpload({ key, originalName }, baseUrl, field) {
    const match = KEY_PATTERN.exec(String(key || ''));
    if (!match) throw ApiError.badRequest(`${field} has an invalid file key.`);

    let head;
    try {
      head = await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
      if (err?.$metadata?.httpStatusCode === 404) {
        throw ApiError.badRequest(`${field} was not uploaded. Please attach it again.`);
      }
      throw err;
    }
    if (head.ContentLength > MAX_BYTES) {
      await this.remove({ storage: 'r2', key });
      throw ApiError.badRequest(`Each file must be ${MAX_BYTES / 1024 / 1024} MB or smaller.`);
    }

    return r2Media({
      key,
      fileName: match[2],
      kind: KIND_BY_FOLDER[match[1]],
      mimeType: head.ContentType || mimeFromName(key),
      size: head.ContentLength ?? null,
      originalName,
      baseUrl,
    });
  }

  /** A short-lived signed URL for reading one R2 object. */
  async signedReadUrl(key) {
    if (!isR2Configured) throw ApiError.notFound('Media not found.');
    if (!KEY_PATTERN.test(String(key || ''))) throw ApiError.badRequest('Invalid media key.');
    return getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), {
      expiresIn: READ_URL_TTL,
    });
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
          fileName: filename,
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
      if (!media) return;
      if (media.storage === 'r2' && media.key && isR2Configured) {
        await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: media.key }));
      } else if (media.storage === 'gridfs' && mongoose.Types.ObjectId.isValid(media.publicId)) {
        await getBucket().delete(new mongoose.Types.ObjectId(media.publicId));
      }
    } catch (err) {
      console.warn('[storage] cleanup failed:', err.message);
    }
  }
}

/** A fresh, unguessable object key such as evidence/images/1790758210571-66b92d1ca2a38a8f.jpg */
function newObjectKey(kind, mimetype, originalName) {
  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extensionFor(mimetype, originalName)}`;
  return { key: `${prefix}/${FOLDERS[kind] || FOLDERS.image}/${fileName}`, fileName };
}

/** Keeps a known media extension from the original name, else derives one from the type. */
function extensionFor(mimetype, originalName) {
  const ext = extensionOf(originalName);
  if (Object.prototype.hasOwnProperty.call(EXTENSION_MIME, ext)) return ext;
  const bare = String(mimetype || '').toLowerCase().split(';')[0].trim();
  return Object.keys(EXTENSION_MIME).find((e) => EXTENSION_MIME[e] === bare) || 'bin';
}

function r2Media({ key, fileName, kind, mimeType, size, originalName, baseUrl }) {
  return {
    // Stable link to this API, which redirects to a fresh signed R2 URL.
    url: `${trimSlash(baseUrl)}/api/media/r2/${key}`,
    kind,
    mimeType: mimeType || null,
    size: size ?? null,
    storage: 'r2',
    key,
    fileName,
    originalName: originalName ? String(originalName).slice(0, 260) : null,
  };
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
