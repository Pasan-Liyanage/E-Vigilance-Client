/** Shared mapping between media file extensions and mime types. */

const EXTENSION_MIME = {
  // images
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif',
  tif: 'image/tiff', tiff: 'image/tiff', avif: 'image/avif',
  // video
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  avi: 'video/x-msvideo', mkv: 'video/x-matroska', '3gp': 'video/3gpp', '3g2': 'video/3gpp2',
  // audio
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
  ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/opus', weba: 'audio/webm',
  amr: 'audio/amr', caf: 'audio/x-caf',
};

const MEDIA_EXTENSIONS = Object.keys(EXTENSION_MIME);

/** Lowercased extension of a filename, or '' when there is none. */
function extensionOf(filename) {
  const name = String(filename || '');
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

/** True when the filename ends in a known photo, video or audio extension. */
function isMediaExtension(filename) {
  return Object.prototype.hasOwnProperty.call(EXTENSION_MIME, extensionOf(filename));
}

/** Best-effort mime type for a filename, or null. */
function mimeFromName(filename) {
  return EXTENSION_MIME[extensionOf(filename)] || null;
}

module.exports = { EXTENSION_MIME, MEDIA_EXTENSIONS, extensionOf, isMediaExtension, mimeFromName };
