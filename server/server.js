require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { connectDB } = require('./src/config/database');
const { isCloudinaryConfigured } = require('./src/config/cloudinary');
const authRoutes = require('./src/routes/authRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const mediaRoutes = require('./src/routes/mediaRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

/* ---------------------------------- CORS --------------------------------- */
const allowed = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // No origin = same-origin, curl or a native webview.
      if (!origin) return cb(null, true);
      if (!allowed.length || allowed.includes(origin)) return cb(null, true);
      // Any LAN address is allowed in development so a real phone can connect.
      if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
        return cb(null, true);
      }
      cb(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);

/* -------------------------------- Parsers -------------------------------- */
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
    endpoints: {
      'POST /api/auth/register': 'Create a citizen account',
      'POST /api/auth/login': 'Sign in',
      'GET  /api/auth/me': 'Current user (Bearer token)',
      'PATCH /api/auth/me': 'Update profile',
      'POST /api/reports': 'Submit a violation report (multipart)',
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
 * CORS or proxy is needed. Without a build, "/" just describes the API.
 */
const webDist = path.join(__dirname, '..', 'web', 'dist');
if (require('fs').existsSync(path.join(webDist, 'index.html'))) {
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
app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    message: status >= 500 ? 'Something went wrong on our side. Please try again.' : err.message,
  });
});

/* --------------------------------- Start --------------------------------- */
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  E-Vigilance API');
    console.log(`  -> http://localhost:${PORT}`);
    console.log(`  -> media storage: ${isCloudinaryConfigured ? 'Cloudinary' : 'MongoDB GridFS'}`);
    console.log('');
  });
});

module.exports = app;
