const mongoose = require('mongoose');

let bucket = null;

/**
 * Opens the shared MongoDB Atlas connection (same cluster the admin panel reads).
 * Also prepares a GridFS bucket used as the default media store.
 */
async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('[db] MONGO_URI is missing. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  mongoose.set('strictQuery', true);

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 10,
    });
    const { GridFSBucket } = require('mongodb');
    bucket = new GridFSBucket(conn.connection.db, { bucketName: 'evidence' });
    console.log(`[db] MongoDB connected successfully -> ${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

/** Returns the GridFS bucket used for evidence media. */
function getBucket() {
  if (!bucket) throw new Error('GridFS bucket is not ready - connectDB() must run first.');
  return bucket;
}

module.exports = { connectDB, getBucket };
