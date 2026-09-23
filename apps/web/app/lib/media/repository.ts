import { neon } from "@neondatabase/serverless";
import type { AdminMediaPage, MediaAsset, MediaMimeType } from "@irishpub-map/shared/media";
import { ADMIN_MEDIA_PAGE_SIZE } from "@irishpub-map/shared/media";
import { isE2ETestMode, rejectE2ETestMutation } from "../e2e-test-mode";
import { E2E_TEST_DATA } from "../e2e-test-fixtures";

const E2E_MEDIA = [E2E_TEST_DATA.media.landscape, E2E_TEST_DATA.media.portrait];

type Row = {
  id: string;
  url: string;
  mime_type: MediaMimeType;
  width: number;
  height: number;
  file_size: number;
  created_at: Date | string;
  total?: number;
};
let sqlClient: ReturnType<typeof neon> | null = null;
/**
 * Reports whether a Neon database URL is configured.
 * @returns {boolean} True when configured.
 */
export function isMediaDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
/**
 * Returns the lazy Neon client.
 * @returns {ReturnType<typeof neon>} Configured client.
 */
function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("Media database unavailable.");
  return (sqlClient ??= neon(process.env.DATABASE_URL));
}
/**
 * Removes database-only fields and serializes a row into the shared DTO.
 * @param {Row} row - Database row.
 * @returns {MediaAsset} Public media DTO.
 */
function toAsset(row: Row): MediaAsset {
  return {
    id: row.id,
    url: row.url,
    mimeType: row.mime_type,
    width: Number(row.width),
    height: Number(row.height),
    fileSize: Number(row.file_size),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Loads a stable, fixed-size page without exposing storage keys.
 * @param {number} page - One-based page number.
 * @returns {Promise<AdminMediaPage>} Media page.
 */
export async function listMediaAssets(page: number): Promise<AdminMediaPage> {
  if (isE2ETestMode()) {
    const offset = (page - 1) * ADMIN_MEDIA_PAGE_SIZE;
    return {
      media: E2E_MEDIA.slice(offset, offset + ADMIN_MEDIA_PAGE_SIZE),
      total: E2E_MEDIA.length,
      page,
      pageSize: ADMIN_MEDIA_PAGE_SIZE,
    };
  }
  const sql = getSql();
  const offset = (page - 1) * ADMIN_MEDIA_PAGE_SIZE;
  const [countRows, rows] = (await Promise.all([
    sql`SELECT COUNT(*)::integer AS total FROM media_assets`,
    sql`SELECT id::text, url, mime_type, width, height, file_size, created_at
        FROM media_assets ORDER BY created_at DESC, id DESC LIMIT ${ADMIN_MEDIA_PAGE_SIZE} OFFSET ${offset}`,
  ])) as [Array<{ total: number }>, Row[]];
  return { media: rows.map(toAsset), total: Number(countRows[0]?.total ?? 0), page, pageSize: ADMIN_MEDIA_PAGE_SIZE };
}

/**
 * Loads one public DTO by UUID.
 * @param {string} id - Asset UUID.
 * @returns {Promise<MediaAsset | null>} DTO or null.
 */
export async function getMediaAsset(id: string): Promise<MediaAsset | null> {
  if (isE2ETestMode()) return E2E_MEDIA.find((asset) => asset.id === id) ?? null;
  const rows =
    (await getSql()`SELECT id::text, url, mime_type, width, height, file_size, created_at FROM media_assets WHERE id = ${id}::uuid`) as Row[];
  return rows[0] ? toAsset(rows[0]) : null;
}

/**
 * Inserts the asset metadata after Blob upload.
 * @param {object} asset - Verified metadata and internal Storage key.
 * @param {string} asset.id - Generated UUID.
 * @param {string} asset.storageKey - Private Blob key.
 * @param {string} asset.url - Public Blob URL.
 * @param {MediaMimeType} asset.mimeType - Detected MIME type.
 * @param {number} asset.width - Verified image width.
 * @param {number} asset.height - Verified image height.
 * @param {number} asset.fileSize - Verified file size.
 * @returns {Promise<MediaAsset>} Public DTO returned by the database.
 */
export async function insertMediaAsset(asset: {
  id: string;
  storageKey: string;
  url: string;
  mimeType: MediaMimeType;
  width: number;
  height: number;
  fileSize: number;
}): Promise<MediaAsset> {
  rejectE2ETestMutation();
  const rows = (await getSql()`INSERT INTO media_assets (id, storage_key, url, mime_type, width, height, file_size)
    VALUES (${asset.id}::uuid, ${asset.storageKey}, ${asset.url}, ${asset.mimeType}, ${asset.width}, ${asset.height}, ${asset.fileSize})
    RETURNING id::text, url, mime_type, width, height, file_size, created_at`) as Row[];
  if (!rows[0]) throw new Error("Media insert returned no row.");
  return toAsset(rows[0]);
}
