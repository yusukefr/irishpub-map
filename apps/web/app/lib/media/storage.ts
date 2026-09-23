import { del, put } from "@vercel/blob";
import type { MediaMimeType } from "@irishpub-map/shared/media";

/**
 * Blob storage is available with a local token or Vercel OIDC plus store ID.
 * @returns {boolean} Whether upload credentials are present.
 */
export function isMediaStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID));
}

/**
 * Uploads public media without generated suffixes or overwrite.
 * @param {string} key - UUID-based storage key.
 * @param {Buffer} body - Validated image bytes.
 * @param {MediaMimeType} contentType - Detected MIME type.
 * @returns {ReturnType<typeof put>} Uploaded Blob metadata.
 */
export async function uploadMediaBlob(key: string, body: Buffer, contentType: MediaMimeType) {
  return put(key, body, { access: "public", contentType, addRandomSuffix: false, allowOverwrite: false });
}

/**
 * Deletes a just-uploaded Blob during database compensation.
 * @param {string} url - Blob URL.
 * @returns {Promise<void>} Resolves when deleted.
 */
export async function deleteMediaBlob(url: string) {
  await del(url);
}
