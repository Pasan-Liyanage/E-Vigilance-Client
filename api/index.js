/**
 * Vercel serverless entry point.
 *
 * Vercel's filesystem routing sends "/api" here and "/api/**" to
 * [...path].js; both use this handler, so routing matches the long-lived
 * server exactly.
 *
 * No dotenv here: Vercel injects environment variables into the runtime, and
 * requiring it from this directory would resolve against the repo root rather
 * than server/node_modules. The standalone server.js still loads .env locally.
 */
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
    return res.end(
      JSON.stringify({ message: 'Database unavailable. Please try again shortly.' })
    );
  }
  return app(req, res);
};
