/**
 * Vercel serverless entry point.
 *
 * Vercel's filesystem routing sends "/api" here and "/api/**" to
 * [...path].js; both delegate to the same Express app, so routing stays
 * identical to the long-lived server.
 */
require('dotenv').config();

const app = require('../server/app');
const { connectOnce } = require('../server/src/config/database');

module.exports = async (req, res) => {
  try {
    // Awaited per invocation, but the connection itself is cached and reused.
    await connectOnce();
  } catch (err) {
    console.error('[db]', err.message);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ message: 'Database unavailable. Please try again shortly.' }));
  }
  return app(req, res);
};
