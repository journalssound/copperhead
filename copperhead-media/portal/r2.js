/**
 * copperhead. portal — Cloudflare R2 integration
 * Uses AWS SDK v3 (R2 is S3-compatible)
 *
 * Required env vars:
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_URL  (your public bucket URL, e.g. https://pub-xxx.r2.dev)
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const path = require('path');

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

let client = null;

function getClient() {
  if (client) return client;
  if (!ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    return null;
  }
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

function isConfigured() {
  return !!(ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && BUCKET);
}

/**
 * Generate a unique key for an upload.
 * Organizes files under a folder prefix.
 */
function generateKey(originalName, folder) {
  folder = folder || 'uploads';
  const ext = path.extname(originalName).toLowerCase();
  const id = crypto.randomBytes(12).toString('hex');
  return `${folder}/${id}${ext}`;
}

/**
 * Create a presigned PUT URL for direct client-to-R2 upload.
 * Returns { key, uploadUrl, publicUrl }
 */
async function createPresignedUpload({ originalName, contentType, folder, expiresIn }) {
  const s3 = getClient();
  if (!s3) throw new Error('R2 is not configured');

  const key = generateKey(originalName, folder);
  expiresIn = expiresIn || 3600; // 1 hour default

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn });

  return {
    key,
    uploadUrl,
    publicUrl: PUBLIC_URL ? `${PUBLIC_URL}/${key}` : null,
  };
}

/**
 * Delete an object from R2.
 */
async function deleteObject(key) {
  const s3 = getClient();
  if (!s3) throw new Error('R2 is not configured');

  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }));
}

/**
 * Check if an object exists.
 */
async function headObject(key) {
  const s3 = getClient();
  if (!s3) throw new Error('R2 is not configured');

  try {
    const result = await s3.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
    return { exists: true, size: result.ContentLength, contentType: result.ContentType };
  } catch (e) {
    if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) {
      return { exists: false };
    }
    throw e;
  }
}

module.exports = { isConfigured, createPresignedUpload, deleteObject, headObject, generateKey };
