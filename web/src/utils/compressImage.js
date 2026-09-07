/**
 * Downscales large photos in the browser before they are uploaded.
 *
 * Phone cameras routinely produce 4-12 MB images, which is a problem on
 * serverless hosts that cap request bodies (Vercel: 4.5 MB). Resizing to a
 * sensible resolution keeps every photo comfortably under that, uploads far
 * faster on mobile data, and costs nothing in readability - a number plate is
 * still legible at 1920px.
 *
 * Anything it cannot handle (video, audio, HEIC a browser will not decode) is
 * returned untouched, so this can never block an upload.
 */
const MAX_DIMENSION = 1920;
const TARGET_BYTES = 3.5 * 1024 * 1024; // headroom under a 4.5MB platform cap
const SKIP_BELOW = 1.5 * 1024 * 1024;   // already small enough to leave alone
const QUALITIES = [0.82, 0.7, 0.6];

const toBlob = (canvas, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

/**
 * @param {File} file
 * @returns {Promise<File>} the compressed file, or the original when it is
 *   already small enough, is not an image, or cannot be decoded.
 */
export async function compressImage(file) {
  if (!file || !String(file.type).startsWith('image/')) return file;
  if (file.size <= SKIP_BELOW) return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;

  let bitmap;
  try {
    // from-image applies the EXIF rotation, which drawImage would otherwise drop.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // e.g. a HEIC this browser cannot decode
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    for (const quality of QUALITIES) {
      const blob = await toBlob(canvas, quality);
      if (!blob) return file;
      const smallEnough = blob.size <= TARGET_BYTES;
      const isLast = quality === QUALITIES[QUALITIES.length - 1];
      if (smallEnough || isLast) {
        // Never hand back something larger than what we started with.
        if (blob.size >= file.size) return file;
        const name = `${String(file.name || 'photo').replace(/\.[^./\\]+$/, '')}.jpg`;
        return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
      }
    }
    return file;
  } catch {
    return file;
  } finally {
    bitmap.close?.();
  }
}
