/**
 * Builds the Express app. Deliberately does NOT connect to Mongo or listen,
 * so it can be reused by both entry points:
 *   server.js        - long-lived process (local, Docker, Render)
 *   ../api/index.js  - Vercel serverless function
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { isCloudinaryConfigured } = require('./src/config/cloudinary');
const authRoutes = require('./src/routes/authRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const mediaRoutes = require('./src/routes/mediaRoutes');

const app = express();

app.set('trust proxy', 1);

/* ---------------------------------- CORS --------------------------------- */
const allowed = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** Same-origin requests still carry an Origin header on POST, so compare hosts. */
function isSameOrigin(req, origin) {
  try {
    return new URL(origin).host === (req.headers['x-forwarded-host'] || req.headers.host);
  } catch {
    return false;
  }
}

app.use(
  cors((req, done) => {
    const origin = req.headers.origin;

    // No Origin at all = same-origin GET, curl, or a native webview.
    if (!origin) return done(null, { origin: true, credentials: true });

    // The app talking to its own API. Browsers send Origin on POST even when
    // the page and the API share a host, so this must be allowed explicitly.
    if (isSameOrigin(req, origin)) return done(null, { origin: true, credentials: true });

    if (allowed.includes(origin)) return done(null, { origin: true, credentials: true });

    // Any LAN address is allowed in development so a real phone can connect.
    if (
      process.env.NODE_ENV !== 'production' &&
      /^https?:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)
    ) {
      return done(null, { origin: true, credentials: true });
    }

    // Reject as a clear 403 rather than letting it surface as a 500.
    const err = new Error(`Origin ${origin} is not allowed to call this API.`);
    err.status = 403;
    return done(err);
  })
);

/* -------------------------------- Parsers -------------------------------- */
// 2mb covers JSON report submissions, where media is already uploaded and the
// body carries only URLs. Binary uploads go through multer, not here.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

/* ------------------------------ Rate limiting ---------------------------- */
// Only the credential endpoints are throttled. GET /api/auth/me runs on every
// page load, so rate limiting the whole namespace would punish normal use.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});

app.use('/api/auth/login', credentialLimiter);
app.use('/api/auth/register', credentialLimiter);

/* --------------------------------- Routes -------------------------------- */
const apiInfo = (req, res) => {
  res.json({
    name: 'E-Vigilance API',
    version: '1.0.0',
    status: 'running',
    mediaStorage: isCloudinaryConfigured ? 'cloudinary' : 'gridfs',
    directUpload: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
    endpoints: {
      'POST /api/auth/register': 'Create a citizen account',
      'POST /api/auth/login': 'Sign in',
      'GET  /api/auth/me': 'Current user (Bearer token)',
      'PATCH /api/auth/me': 'Update profile',
      'POST /api/reports': 'Submit a violation report (multipart or JSON)',
      'GET  /api/reports': "List the user's reports",
      'GET  /api/reports/stats': 'Dashboard counters',
      'GET  /api/reports/:id': 'One report',
      'GET  /api/media/:id': 'Stream GridFS evidence',
    },
  });
};

app.get('/api', apiInfo);
app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/media', mediaRoutes);

/* ------------------- Serve the built PWA (production) --------------------
 * When web/dist exists the API and the PWA are served from one origin, so no
 * CORS or proxy is needed. On Vercel the static files are served by the
 * platform instead, so this block is simply skipped.
 */
const webDist = path.join(__dirname, '..', 'web', 'dist');
if (fs.existsSync(path.join(webDist, 'index.html'))) {
  app.use(
    express.static(webDist, {
      // index.html must never be cached, or clients get stale asset URLs.
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );
  // Client-side routes fall back to the SPA shell; /api/* is left alone.
  app.get(/^\/(?!api(\/|$)).*/, (req, res) => res.sendFile(path.join(webDist, 'index.html')));
} else {
  app.get('/', apiInfo);
}

/* ------------------------------ 404 + errors ----------------------------- */
app.use((req, res) =>
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
);

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    message: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message,
  });
});

module.exports = app;
