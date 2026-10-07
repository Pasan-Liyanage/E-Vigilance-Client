/**
 * Uploads evidence straight from the browser to Cloudflare R2.
 *
 * Serverless hosts cap request bodies (Vercel: 4.5 MB for both request and
 * response), which is far below a phone video. The API hands out a signed,
 * single-object PUT URL; the file goes directly to the bucket and the API
 * only ever receives the resulting object key.
 *
 * The bucket needs a CORS rule allowing PUT from this site's origin. Until
 * one exists the browser blocks the request, which surfaces here as a network
 * error - the caller then falls back to uploading through the API.
 */
import { api, ApiError } from './client';
import { ensureFileType } from '../utils/fileType';

/** Thrown when direct upload cannot be used at all, as opposed to failing for one file. */
export class DirectUploadUnavailable extends Error {}

// Once it is known to be unavailable, stop trying for the rest of the session.
let unavailable = false;

export const isDirectUploadAvailable = () => !unavailable;

/**
 * @param {File} file
 * @param {'image'|'video'|'audio'} kind
 * @param {(loadedBytes:number)=>void} onProgress
 * @returns {Promise<{key:string, originalName:string|null}>}
 */
export async function uploadDirect(file, kind, onProgress) {
  if (unavailable) throw new DirectUploadUnavailable('Direct upload is unavailable.');
  const typed = ensureFileType(file, kind);

  let grant;
  try {
    grant = await api.presignUpload({ name: typed.name, type: typed.type, size: typed.size, kind });
  } catch (err) {
    // 501: the server has no R2 configured, so uploads must go through it.
    if (err instanceof ApiError && err.status === 501) {
      unavailable = true;
      throw new DirectUploadUnavailable(err.message);
    }
    throw err;
  }

  await put(grant.uploadUrl, typed, grant.contentType, onProgress);
  return { key: grant.key, originalName: typed.name || null };
}

function put(url, file, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    // Must match the type the URL was signed for, or R2 rejects the signature.
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.timeout = 300000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) onProgress(file.size);
        return resolve();
      }
      reject(new Error(`"${file.name}": upload failed (${xhr.status}).`));
    };

    xhr.onerror = () => {
      // A blocked CORS preflight and a dropped connection look identical here.
      // Either way the API path is the right next attempt.
      if (navigator.onLine) unavailable = true;
      reject(new DirectUploadUnavailable(`"${file.name}": could not reach storage.`));
    };
    xhr.ontimeout = () => reject(new Error(`"${file.name}": upload timed out.`));

    xhr.send(file);
  });
}
