const { S3Client } = require('@aws-sdk/client-s3');

const endpoint = process.env.R2_ENDPOINT;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

/** True only when every Cloudflare R2 credential is present. */
const isR2Configured = Boolean(endpoint && accessKeyId && secretAccessKey);

const bucket = process.env.R2_BUCKET || 'e-vigilance';

/** Top-level folder inside the bucket; each media kind gets a sub-folder. */
const prefix = (process.env.R2_PREFIX || 'evidence').replace(/^\/+|\/+$/g, '');

/** kind -> folder, matching the layout the admin panel already uses. */
const FOLDERS = { image: 'images', video: 'videos', audio: 'audios' };

// R2 speaks the S3 API. Region is required by the SDK but ignored by R2.
const r2 = isR2Configured
  ? new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    })
  : null;

module.exports = { r2, isR2Configured, bucket, prefix, FOLDERS };
