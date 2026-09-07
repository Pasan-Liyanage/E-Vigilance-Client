/**
 * Long-lived entry point (local development, Docker, Render).
 * Vercel uses ../api/index.js instead, which shares the same Express app.
 */
require('dotenv').config();

const app = require('./app');
const { connectDB } = require('./src/config/database');
const { isCloudinaryConfigured } = require('./src/config/cloudinary');

const PORT = process.env.PORT || 5000;

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
