/**
 * Guarantees every attached file carries a concrete MIME type.
 *
 * Some Android browsers and file pickers hand back a File with an empty
 * `type`. The browser then omits the part's Content-Type when it is uploaded,
 * and the server sees `text/plain` (the RFC 7578 default), which used to be
 * rejected as an unsupported file. Re-wrapping with a type inferred from the
 * extension keeps the upload well-formed.
 */
const EXTENSION_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif',
  tif: 'image/tiff', tiff: 'image/tiff', avif: 'image/avif',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  avi: 'video/x-msvideo', mkv: 'video/x-matroska', '3gp': 'video/3gpp', '3g2': 'video/3gpp2',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac',
  ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/opus', weba: 'audio/webm',
  amr: 'audio/amr', caf: 'audio/x-caf',
};

/** Best-effort MIME type from a filename. */
export function mimeFromName(name = '') {
  const i = String(name).lastIndexOf('.');
  if (i === -1) return null;
  return EXTENSION_MIME[String(name).slice(i + 1).toLowerCase()] || null;
}

/**
 * Returns the file unchanged when it already has a type, otherwise a copy
 * with one inferred from its name (falling back to a sensible default).
 *
 * @param {File} file
 * @param {'image'|'video'|'audio'} fallbackKind used when the name gives nothing
 */
export function ensureFileType(file, fallbackKind = 'image') {
  if (!file) return file;
  if (file.type && file.type.trim()) return file;

  const guessed =
    mimeFromName(file.name) ||
    { image: 'image/jpeg', video: 'video/mp4', audio: 'audio/webm' }[fallbackKind] ||
    'application/octet-stream';

  try {
    return new File([file], file.name || `evidence.${guessed.split('/')[1]}`, {
      type: guessed,
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return file; // very old browsers without the File constructor
  }
}
