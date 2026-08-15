import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { asPubs, type Pub } from "@irishpub-map/shared/pub";
import { getValidatedPubs } from "./pub-data";

type DbPubRow = {
  id: unknown;
  name: unknown;
  kana: unknown;
  prefecture: unknown;
  city: unknown;
  address: unknown;
  latitude: unknown;
  longitude: unknown;
  website_url: unknown;
  google_maps_url: unknown;
  instagram_url: unknown;
  tags: unknown;
  status: unknown;
};

let sqlClient: ReturnType<typeof neon> | null = null;

/**
 * Neonへの接続設定があり、永続化を利用できるかを返します。
 * @returns {boolean} DB接続設定が存在する場合はtrue。
 */
export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Neon設定時は独立カラムから、未設定時は検証済みJSONから店舗一覧を取得します。
 * @returns {Promise<Pub[]>} 検証済みの店舗一覧。
 */
export async function getPubs() {
  if (!isDatabaseConfigured()) return getValidatedPubs();

  const sql = getSql();
  await ensureTable(sql);
  const rows = (await sql`
    SELECT id::text, name, kana, prefecture, city, address, latitude, longitude,
      website_url, google_maps_url, instagram_url, tags, status
    FROM pubs
    ORDER BY prefecture, name
  `) as DbPubRow[];
  return parseDbPubs(rows);
}

/**
 * 外部入力を店舗型として検証し、新しいUUIDを付けて独立カラムへ永続化します。
 * @param {unknown} value - 検証・登録する外部入力。
 * @returns {Promise<Pub>} 登録した店舗。
 */
export async function createPub(value: unknown) {
  const pub = toPub(value, randomUUID());
  const sql = getRequiredSql();
  await ensureTable(sql);
  await insertPub(sql, pub);
  return pub;
}

/**
 * 外部入力を既存UUIDの店舗型として検証し、独立カラムを更新します。
 * @param {string} id - 更新対象の店舗ID。
 * @param {unknown} value - 検証・保存する店舗データ。
 * @returns {Promise<Pub | null>} 更新した店舗、または対象がない場合のnull。
 */
export async function updatePub(id: string, value: unknown) {
  const pub = toPub(value, id);
  const sql = getRequiredSql();
  await ensureTable(sql);
  const rows = (await sql`
    UPDATE pubs
    SET name = ${pub.name}, kana = ${toNullable(pub.kana)}, prefecture = ${pub.prefecture},
      city = ${toNullable(pub.city)}, address = ${pub.address}, latitude = ${pub.latitude}, longitude = ${pub.longitude},
      website_url = ${toNullable(pub.websiteUrl)}, google_maps_url = ${toNullable(pub.googleMapsUrl)},
      instagram_url = ${toNullable(pub.instagramUrl)},
      tags = ${pub.tags}, status = ${pub.status}, updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id::text, name, kana, prefecture, city, address, latitude, longitude,
      website_url, google_maps_url, instagram_url, tags, status
  `) as DbPubRow[];
  return rows.length === 1 ? toPub(rows[0]) : null;
}

/**
 * 指定UUIDの店舗を削除し、実際に削除できたかを返します。
 * @param {string} id - 削除対象の店舗ID。
 * @returns {Promise<boolean>} 店舗を削除できた場合はtrue。
 */
export async function deletePub(id: string) {
  const sql = getRequiredSql();
  await ensureTable(sql);
  const rows = (await sql`DELETE FROM pubs WHERE id = ${id}::uuid RETURNING id`) as Array<{ id: string }>;
  return rows.length === 1;
}

function getRequiredSql() {
  if (!isDatabaseConfigured()) throw new Error("Database is not configured.");
  return getSql();
}

function getSql() {
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL!);
  return sqlClient;
}

async function ensureTable(sql: ReturnType<typeof neon>) {
  await sql`
    CREATE TABLE IF NOT EXISTS pubs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL CHECK (btrim(name) <> ''),
      kana TEXT,
      prefecture TEXT NOT NULL CHECK (btrim(prefecture) <> ''),
      city TEXT,
      address TEXT NOT NULL CHECK (btrim(address) <> ''),
      latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
      longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
      website_url TEXT CHECK (website_url IS NULL OR website_url ~* '^https?://'),
      google_maps_url TEXT CHECK (google_maps_url IS NULL OR google_maps_url ~* '^https?://'),
      instagram_url TEXT CHECK (instagram_url IS NULL OR instagram_url ~* '^https?://'),
      tags TEXT[] NOT NULL DEFAULT '{}' CHECK (array_position(tags, NULL) IS NULL),
      status TEXT NOT NULL CHECK (status IN ('open', 'temporarily_closed', 'closed', 'unknown')),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS pubs_prefecture_name_idx ON pubs (prefecture, name)`;
  await sql`CREATE INDEX IF NOT EXISTS pubs_city_idx ON pubs (city)`;
  await sql`CREATE INDEX IF NOT EXISTS pubs_kana_idx ON pubs (kana)`;
  await sql`CREATE INDEX IF NOT EXISTS pubs_status_idx ON pubs (status)`;
  await sql`CREATE INDEX IF NOT EXISTS pubs_tags_gin_idx ON pubs USING GIN (tags)`;

  const rows = (await sql`SELECT COUNT(*)::int AS count FROM pubs`) as Array<{ count: number }>;
  if (rows[0]?.count === 0) {
    // 空のDBだけを初期化し、既存の管理データを初期JSONで上書きしないようにします。
    for (const pub of getValidatedPubs()) await insertPub(sql, pub, true);
  }
}

async function insertPub(sql: ReturnType<typeof neon>, pub: Pub, skipExisting = false) {
  await sql`
    INSERT INTO pubs (
      id, name, kana, prefecture, city, address, latitude, longitude,
      website_url, google_maps_url, instagram_url, tags, status
    ) VALUES (
      ${pub.id}::uuid, ${pub.name}, ${toNullable(pub.kana)}, ${pub.prefecture}, ${toNullable(pub.city)}, ${pub.address},
      ${pub.latitude}, ${pub.longitude}, ${toNullable(pub.websiteUrl)}, ${toNullable(pub.googleMapsUrl)},
      ${toNullable(pub.instagramUrl)}, ${pub.tags}, ${pub.status}
    )
    ${skipExisting ? sql`ON CONFLICT (id) DO NOTHING` : sql``}
  `;
}

function toPub(row: DbPubRow): Pub;
function toPub(value: unknown, id: string): Pub;
function toPub(value: DbPubRow | unknown, id?: string): Pub {
  if (id !== undefined) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid pub data.");
    return asPubs([{ ...(value as Record<string, unknown>), id }])[0];
  }

  const row = normalizeDbRow(value as DbPubRow);
  if (!row) throw new Error("Invalid database pub row.");

  return asPubs([
    {
      id: row.id,
      name: row.name,
      kana: row.kana ?? undefined,
      prefecture: row.prefecture,
      city: row.city ?? undefined,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      websiteUrl: row.websiteUrl,
      googleMapsUrl: row.googleMapsUrl,
      instagramUrl: row.instagramUrl,
      tags: row.tags,
      status: row.status,
    },
  ])[0];
}

function toNullable(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : value;
  return normalized || null;
}
/**
 * DBドライバーの返却値を店舗単位で検証し、有効な店舗だけを返します。
 * @param {unknown[]} rows - DBドライバーから返された行。
 * @returns {Pub[]} 有効な店舗のみを含む一覧。
 */
export function parseDbPubs(rows: unknown[]) {
  const pubs: Pub[] = [];
  let skippedCount = 0;

  for (const row of rows) {
    try {
      pubs.push(toPub(row as DbPubRow));
    } catch {
      skippedCount += 1;
    }
  }

  if (skippedCount > 0) {
    console.error("Skipped invalid pub rows from the database.", {
      skippedCount,
      totalCount: rows.length,
    });
  }

  if (rows.length > 0 && pubs.length === 0) {
    throw new Error("No valid pub data found in database.");
  }

  return asPubs(pubs);
}

function normalizeDbRow(row: DbPubRow) {
  if (!row || typeof row !== "object") return null;

  return {
    id: normalizeText(row.id),
    name: normalizeText(row.name),
    kana: normalizeOptionalText(row.kana),
    prefecture: normalizeText(row.prefecture),
    city: normalizeOptionalText(row.city),
    address: normalizeText(row.address),
    latitude: normalizeNumber(row.latitude),
    longitude: normalizeNumber(row.longitude),
    websiteUrl: normalizeOptionalText(row.website_url),
    googleMapsUrl: normalizeOptionalText(row.google_maps_url),
    instagramUrl: normalizeOptionalText(row.instagram_url),
    tags: normalizeTags(row.tags),
    status: normalizeText(row.status),
  };
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeOptionalText(value: unknown) {
  if (value === null || value === undefined) return undefined;
  return typeof value === "string" ? value.trim() || undefined : value;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || value.trim() === "") return value;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : value;
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) return value.map((tag) => normalizeText(tag));
  if (typeof value !== "string") return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((tag) => normalizeText(tag)) : value;
  } catch {
    return value;
  }
}
