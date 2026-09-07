const mongoose = require('mongoose');

/**
 * Serverless platforms reuse a warm process across invocations but may also
 * spin up many of them. Caching the connection promise on globalThis means a
 * warm function reuses one connection instead of opening a new one per
 * request, which would otherwise exhaust the Atlas connection limit.
 */
const cache = globalThis.__evigilanceMongo || (globalThis.__evigilanceMongo = {
  conn: null,
  promise: null,
  bucket: null,
});

function open(uri) {
  mongoose.set('strictQuery', true);
  return mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 10,
      // Fail fast instead of queueing queries when the connection drops.
      bufferCommands: false,
    })
    .then((conn) => {
      const { GridFSBucket } = require('mongodb');
      cache.bucket = new GridFSBucket(conn.connection.db, { bucketName: 'evidence' });
      cache.conn = conn;
      return conn;
    })
    .catch((err) => {
      // Let the next invocation retry rather than caching a failed promise.
      cache.promise = null;
      throw err;
    });
}

/** Connects if needed and resolves once the connection is usable. */
async function connectOnce() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not configured.');
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (!cache.promise) cache.promise = open(uri);
  return cache.promise;
}

/**
 * Entry point for the long-lived server: same connection, but a failure here
 * is fatal because there is nothing useful to serve without a database.
 */
async function connectDB() {
  try {
    const conn = await connectOnce();
    console.log(`[db] MongoDB connected successfully -> ${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    process.exit(1);
  }
}

/** Returns the GridFS bucket used for evidence media. */
function getBucket() {
  if (!cache.bucket) throw new Error('GridFS bucket is not ready - connect first.');
  return cache.bucket;
}

module.exports = { connectDB, connectOnce, getBucket };
