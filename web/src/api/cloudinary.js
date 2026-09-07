/**
 * Uploads evidence straight from the browser to Cloudinary.
 *
 * Serverless hosts cap request bodies (Vercel: 4.5 MB for both request and
 * response), which is far below a phone video. Sending media directly to
 * Cloudinary keeps it off the API path entirely - the API only ever receives
 * the resulting URLs, and playback comes from Cloudinary's CDN.
 *
 * This uses an *unsigned* upload preset, so no API secret is exposed. Restrict
 * the preset in the Cloudinary dashboard (allowed formats, max file size).
 */
const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '';
const FOLDER = import.meta.env.VITE_CLOUDINARY_FOLDER || 'evigilance/violations';

/** True when the build is configured to upload media directly. */
export const isDirectUploadEnabled = () => Boolean(CLOUD && PRESET);

/** Maps a browser File onto the kind the API stores. */
export function kindOf(file) {
  const t = String(file?.type || '').toLowerCase();
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  return 'image';
}

/**
 * @param {File} file
 * @param {(loadedBytes:number)=>void} onProgress
 * @returns {Promise<{url,kind,mimeType,size,publicId,originalName}>}
 */
export function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    if (!isDirectUploadEnabled()) {
      return reject(new Error('Direct upload is not configured for this build.'));
    }

    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', PRESET);
    if (FOLDER) form.append('folder', FOLDER);

    const xhr = new XMLHttpRequest();
    // "auto" lets Cloudinary sort images, video and audio out for itself.
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD}/auto/upload`);
    xhr.timeout = 300000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded);
    };

    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch { /* non-JSON */ }

      if (xhr.status < 200 || xhr.status >= 300) {
        const why = data?.error?.message || `upload failed (${xhr.status})`;
        return reject(new Error(`"${file.name}": ${why}`));
      }
      if (onProgress) onProgress(file.size);

      resolve({
        url: data.secure_url,
        kind: kindOf(file),
        mimeType: file.type || null,
        size: file.size,
        publicId: data.public_id || null,
        originalName: file.name || null,
      });
    };

    xhr.onerror = () => reject(new Error(`"${file.name}": network error while uploading.`));
    xhr.ontimeout = () => reject(new Error(`"${file.name}": upload timed out.`));

    xhr.send(form);
  });
}
