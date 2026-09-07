/**
 * Thin fetch wrapper around the E-Vigilance API.
 * Adds the Bearer token, normalises errors and reports upload progress.
 */

const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/**
 * With no VITE_API_URL the app assumes the API is same-origin, which is true
 * locally and in Docker. On a static host serving from a sub-path (GitHub
 * Pages) there is no API to talk to, so say that plainly instead of letting
 * every call fail as an unexplained 404.
 */
const API_CONFIGURED = Boolean(BASE) || import.meta.env.BASE_URL === '/';
const NOT_CONFIGURED =
  'This build has no backend configured. Set the VITE_API_URL repository ' +
  'variable to your API URL and re-run the deploy workflow.';

const TOKEN_KEY = 'evigilance.token';

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t) => {
    try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
  },
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

/** Listeners fired when the API reports an expired/invalid session. */
const unauthorizedHandlers = new Set();
export const onUnauthorized = (fn) => {
  unauthorizedHandlers.add(fn);
  return () => unauthorizedHandlers.delete(fn);
};

async function request(path, { method = 'GET', body, headers = {}, auth = true, signal } = {}) {
  const opts = { method, headers: { ...headers }, signal };

  if (auth) {
    const token = tokenStore.get();
    if (token) opts.headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  if (!API_CONFIGURED) throw new ApiError(NOT_CONFIGURED, 0);

  let res;
  try {
    res = await fetch(`${BASE}${path}`, opts);
  } catch {
    throw new ApiError(
      navigator.onLine
        ? 'Cannot reach the server. Please check that the API is running.'
        : 'You appear to be offline. Reconnect and try again.',
      0
    );
  }

  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }

  if (!res.ok) {
    if (res.status === 401 && auth) unauthorizedHandlers.forEach((fn) => fn());
    throw new ApiError(data.message || `Request failed (${res.status})`, res.status);
  }
  return data;
}

/**
 * Multipart POST with upload progress, via XHR (fetch cannot report progress).
 * @param {FormData} formData
 * @param {(percent:number)=>void} onProgress
 */
function upload(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    if (!API_CONFIGURED) return reject(new ApiError(NOT_CONFIGURED, 0));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${BASE}${path}`);

    const token = tokenStore.get();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let data = {};
      try { data = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch { /* non-JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
      if (xhr.status === 401) unauthorizedHandlers.forEach((fn) => fn());
      reject(new ApiError(data.message || `Upload failed (${xhr.status})`, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError('Network error while uploading. Please try again.', 0));
    xhr.ontimeout = () => reject(new ApiError('The upload timed out. Please try again.', 0));
    xhr.timeout = 180000;

    xhr.send(formData);
  });
}

/** False when the bundle was built without an API URL for a static host. */
export const isApiConfigured = () => API_CONFIGURED;

export const api = {
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload, auth: false }),
  me: () => request('/api/auth/me'),
  updateProfile: (payload) => request('/api/auth/me', { method: 'PATCH', body: payload }),

  createReport: (formData, onProgress) => upload('/api/reports', formData, onProgress),
  listReports: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(
        ([k, v]) => v !== undefined && v !== null && v !== '' && !(k === 'status' && v === 'All')
      )
    ).toString();
    return request(`/api/reports${qs ? `?${qs}` : ''}`);
  },
  getReport: (id) => request(`/api/reports/${id}`),
  stats: () => request('/api/reports/stats'),
};
