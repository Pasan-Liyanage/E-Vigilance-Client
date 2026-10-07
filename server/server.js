/**
 * Long-lived entry point (local development, Docker, Render).
 * Vercel uses ../api/index.js instead, which shares the same Express app.
 */
require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./src/config/database');
const StorageService = require('./src/services/storageService');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('  E-Vigilance API');
    console.log(`  -> http://localhost:${PORT}`);
    console.log(`  -> media storage: ${StorageService.driver === 'r2' ? 'Cloudflare R2' : 'MongoDB GridFS'}`);
    console.log('');
  });
});

module.exports = app;
