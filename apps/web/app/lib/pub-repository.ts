import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { PREFECTURES, getPrefectureCode, getPrefectureName } from "@irishpub-map/shared/prefecture";
import { getPubStatusCode, getPubStatusValue, PUB_STATUS_DEFINITIONS } from "@irishpub-map/shared/status";
import { asPubs, type Pub } from "@irishpub-map/shared/pub";
import { normalizeTags } from "@irishpub-map/shared/tag";

type DbPubRow = {
  id: unknown;
  name: unknown;
  kana: unknown;
  prefecture_code: unknown;
  prefecture: unknown;
  city: unknown;
  municipality_code: unknown;
  address: unknown;
  latitude: unknown;
  longitude: unknown;
  website_url: unknown;
  google_maps_url: unknown;
  instagram_url: unknown;
  tags: unknown;
  tag_display_names: unknown;
  status_code: unknown;
  status_display_name: unknown;
};

let sqlClient: ReturnType<typeof neon> | null = null;
let schemaReady = false;

/**
 * Neonへの接続設定があり、永続化を利用できるかを返します。
 * @returns {boolean} DB接続設定が存在する場合はtrue。
 */
export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Neon設定時は選択ロケールの翻訳を優先し、未登録時は日本語へフォールバックして店舗一覧を取得します。
 * @param {string} _locale - 優先して取得する表示ロケール。
 * @returns {Promise<Pub[]>} 検証済みの店舗一覧。
 */
export async function getPubs(_locale = "ja") {
  if (!isDatabaseConfigured()) return [];

  const sql = getSql();
  await ensureTable(sql);
  const rows = (await sql`
    WITH locale_preference AS (SELECT ${_locale}::text AS locale, 0 AS priority UNION ALL SELECT 'ja', 1)
    SELECT p.id::text, pt.name, pt.name_reading AS kana, p.prefecture_code, pref.name AS prefecture, mt.name AS city, p.municipality_code, pt.address, p.latitude, p.longitude,
      p.website_url, p.google_maps_url, p.instagram_url, p.status_code, st.display_name AS status_display_name,
      COALESCE(array_agg(t.key ORDER BY t.key) FILTER (WHERE t.key IS NOT NULL), '{}') AS tags,
      COALESCE(jsonb_object_agg(t.key, tt.name) FILTER (WHERE t.key IS NOT NULL), '{}'::jsonb) AS tag_display_names
    FROM pubs p
    JOIN LATERAL (SELECT name, name_reading, address FROM pub_translations tr JOIN locale_preference lp ON lp.locale=tr.locale WHERE tr.pub_id=p.id ORDER BY lp.priority LIMIT 1) pt ON TRUE
    JOIN LATERAL (SELECT tr.name FROM prefecture_translations tr JOIN locale_preference lp ON lp.locale=tr.locale WHERE tr.prefecture_code=p.prefecture_code ORDER BY lp.priority LIMIT 1) pref ON TRUE
    LEFT JOIN LATERAL (SELECT tr.name FROM municipality_translations tr JOIN locale_preference lp ON lp.locale=tr.locale WHERE tr.municipality_code=p.municipality_code ORDER BY lp.priority LIMIT 1) mt ON TRUE
    JOIN LATERAL (SELECT display_name FROM pub_status_translations tr JOIN locale_preference lp ON lp.locale=tr.locale WHERE tr.status_code=p.status_code ORDER BY lp.priority LIMIT 1) st ON TRUE
    LEFT JOIN pub_tags ptag ON ptag.pub_id=p.id LEFT JOIN tags t ON t.id=ptag.tag_id
    LEFT JOIN LATERAL (SELECT name FROM tag_translations tr JOIN locale_preference lp ON lp.locale=tr.locale WHERE tr.tag_id=t.id ORDER BY lp.priority LIMIT 1) tt ON TRUE
    GROUP BY p.id, pt.name, pt.name_reading, pref.name, mt.name, pt.address, st.display_name
    ORDER BY p.municipality_code::bigint, pt.name, p.id
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
  return (await getPubById(sql, pub.id))!;
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
    SET name = ${pub.name}, kana = ${toNullable(pub.kana)}, prefecture_code = ${getRequiredPrefectureCode(pub.prefecture)},
      city = ${toNullable(pub.city)}, address = ${pub.address}, latitude = ${pub.latitude}, longitude = ${pub.longitude},
      website_url = ${toNullable(pub.websiteUrl)}, google_maps_url = ${toNullable(pub.googleMapsUrl)},
      instagram_url = ${toNullable(pub.instagramUrl)}, status_code = ${getRequiredStatusCode(pub.status)}, updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id
  `) as Array<{ id: string }>;
  if (rows.length !== 1) return null;
  await replacePubTags(sql, pub.id, pub.tags);
  return getPubById(sql, pub.id);
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
  if (schemaReady) return;

  const municipalityTable = (await sql`
    SELECT to_regclass('public.municipality_codes')::text AS table_name
  `) as Array<{ table_name: string | null }>;
  if (!municipalityTable[0]?.table_name) {
    throw new Error("Municipality code table is missing. Run db/migrations/003_municipality_codes_up.sql first.");
  }
  const municipalityRows = (await sql`SELECT COUNT(*)::int AS count FROM municipality_codes`) as Array<{
    count: number;
  }>;
  if (municipalityRows[0]?.count === 0) {
    throw new Error("Municipality code table is empty. Run db/migrations/003_municipality_codes_up.sql first.");
  }

  const tagSchema = (await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('pub_tags', 'tags')
  `) as Array<{ table_name: string; column_name: string }>;
  const pubTagsColumns = new Set(
    tagSchema.filter(({ table_name }) => table_name === "pub_tags").map(({ column_name }) => column_name),
  );
  const tagsColumns = new Set(
    tagSchema.filter(({ table_name }) => table_name === "tags").map(({ column_name }) => column_name),
  );
  const hasTagTables = pubTagsColumns.size > 0 || tagsColumns.size > 0;
  const hasNormalizedTagTables =
    pubTagsColumns.has("pub_id") && pubTagsColumns.has("tag_id") && tagsColumns.has("id") && tagsColumns.has("name");
  if (hasTagTables && !hasNormalizedTagTables) {
    throw new Error(
      "Database schema is not normalized for tags. Run db/migrations/004_normalize_pub_tags_up.sql first.",
    );
  }

  const existingColumns =
    (await sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pubs'`) as Array<{
      column_name: string;
    }>;
  if (
    existingColumns.length > 0 &&
    (!existingColumns.some(({ column_name }) => column_name === "prefecture_code") ||
      !existingColumns.some(({ column_name }) => column_name === "status_code"))
  ) {
    throw new Error("Database schema is not normalized. Run db/migrations/002_normalize_pub_metadata_up.sql first.");
  }
  await sql`CREATE TABLE IF NOT EXISTS pubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (btrim(name) <> ''),
    kana TEXT,
    prefecture_code SMALLINT NOT NULL,
    city TEXT,
    address TEXT NOT NULL CHECK (btrim(address) <> ''),
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    website_url TEXT CHECK (website_url IS NULL OR website_url ~* '^https?://'),
    google_maps_url TEXT CHECK (google_maps_url IS NULL OR google_maps_url ~* '^https?://'),
    instagram_url TEXT CHECK (instagram_url IS NULL OR instagram_url ~* '^https?://'),
    status_code SMALLINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS prefectures (code SMALLINT PRIMARY KEY CHECK (code BETWEEN 1 AND 47), name TEXT NOT NULL UNIQUE CHECK (btrim(name) <> ''), kana TEXT NOT NULL CHECK (btrim(kana) <> ''))`;
  await sql`ALTER TABLE prefectures ADD COLUMN IF NOT EXISTS kana TEXT`;
  for (const prefecture of PREFECTURES) {
    await sql`INSERT INTO prefectures (code, name, kana) VALUES (${prefecture.code}, ${prefecture.name}, ${prefecture.kana}) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, kana = EXCLUDED.kana`;
  }
  await sql`CREATE TABLE IF NOT EXISTS pub_statuses (code SMALLINT PRIMARY KEY, value TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL)`;
  for (const status of PUB_STATUS_DEFINITIONS) {
    await sql`INSERT INTO pub_statuses (code, value, display_name, key) VALUES (${status.code}, ${status.value}, ${status.displayName}, ${status.value}) ON CONFLICT (code) DO UPDATE SET value = EXCLUDED.value, display_name = EXCLUDED.display_name, key = EXCLUDED.key`;
  }
  await sql`ALTER TABLE pubs DROP CONSTRAINT IF EXISTS pubs_prefecture_code_fkey`;
  await sql`ALTER TABLE pubs DROP CONSTRAINT IF EXISTS pubs_status_code_fkey`;
  await sql`ALTER TABLE pubs ADD CONSTRAINT pubs_prefecture_code_fkey FOREIGN KEY (prefecture_code) REFERENCES prefectures(code)`;
  await sql`ALTER TABLE pubs ADD CONSTRAINT pubs_status_code_fkey FOREIGN KEY (status_code) REFERENCES pub_statuses(code)`;
  await sql`CREATE TABLE IF NOT EXISTS tags (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE CHECK (btrim(name) <> ''))`;
  await sql`CREATE TABLE IF NOT EXISTS pub_tags (pub_id UUID NOT NULL REFERENCES pubs(id) ON DELETE CASCADE, tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (pub_id, tag_id))`;
  await sql`CREATE INDEX IF NOT EXISTS pubs_prefecture_code_name_idx ON pubs (prefecture_code, name)`;
  await sql`CREATE INDEX IF NOT EXISTS pubs_city_idx ON pubs (city)`;
  await sql`CREATE INDEX IF NOT EXISTS pubs_kana_idx ON pubs (kana)`;
  await sql`CREATE INDEX IF NOT EXISTS pubs_status_code_idx ON pubs (status_code)`;
  await sql`CREATE INDEX IF NOT EXISTS pub_tags_tag_id_idx ON pub_tags (tag_id)`;

  schemaReady = true;
}

async function insertPub(sql: ReturnType<typeof neon>, pub: Pub) {
  await sql`
    INSERT INTO pubs (
      id, name, kana, prefecture_code, city, address, latitude, longitude,
      website_url, google_maps_url, instagram_url, status_code
    ) VALUES (
      ${pub.id}::uuid, ${pub.name}, ${toNullable(pub.kana)}, ${getRequiredPrefectureCode(pub.prefecture)}, ${toNullable(pub.city)}, ${pub.address},
      ${pub.latitude}, ${pub.longitude}, ${toNullable(pub.websiteUrl)}, ${toNullable(pub.googleMapsUrl)},
      ${toNullable(pub.instagramUrl)}, ${getRequiredStatusCode(pub.status)}
    )
  `;
  await replacePubTags(sql, pub.id, pub.tags);
}

async function replacePubTags(sql: ReturnType<typeof neon>, pubId: string, tags: string[]) {
  await sql`DELETE FROM pub_tags WHERE pub_id = ${pubId}::uuid`;
  for (const tag of normalizeTags(tags)) {
    const tagRows = (await sql`
      INSERT INTO tags (name)
      VALUES (${tag})
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `) as Array<{ id: string }>;
    if (tagRows.length !== 1) throw new Error("Could not resolve tag master record.");
    await sql`INSERT INTO pub_tags (pub_id, tag_id) VALUES (${pubId}::uuid, ${tagRows[0].id}::uuid) ON CONFLICT (pub_id, tag_id) DO NOTHING`;
  }
}

async function getPubById(sql: ReturnType<typeof neon>, id: string) {
  const rows = (await sql`
    SELECT p.id::text, p.name, p.kana, p.prefecture_code, p.city, mc.code AS municipality_code, p.address, p.latitude, p.longitude,
      p.website_url, p.google_maps_url, p.instagram_url, p.status_code,
      COALESCE(array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
    FROM pubs AS p
    LEFT JOIN municipality_codes AS mc
      ON mc.prefecture_code = p.prefecture_code AND mc.municipality_name = p.city
    LEFT JOIN pub_tags AS pt ON pt.pub_id = p.id
    LEFT JOIN tags AS t ON t.id = pt.tag_id
    WHERE p.id = ${id}::uuid
    GROUP BY p.id, p.name, p.kana, p.prefecture_code, p.city, mc.code, p.address, p.latitude, p.longitude,
      p.website_url, p.google_maps_url, p.instagram_url, p.status_code
  `) as DbPubRow[];
  return rows.length === 1 ? toPub(rows[0]) : null;
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
      municipalityCode: row.municipalityCode,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      websiteUrl: row.websiteUrl,
      googleMapsUrl: row.googleMapsUrl,
      instagramUrl: row.instagramUrl,
      tags: row.tags,
      tagDisplayNames: row.tagDisplayNames,
      status: row.status,
      statusDisplayName: row.statusDisplayName,
    },
  ])[0];
}

function toNullable(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : value;
  return normalized || null;
}

function getRequiredPrefectureCode(name: string) {
  const code = getPrefectureCode(name);
  if (code === undefined) throw new Error(`Unknown prefecture: ${name}`);
  return code;
}

function getRequiredStatusCode(value: Pub["status"]) {
  const code = getPubStatusCode(value);
  if (code === undefined) throw new Error(`Unknown pub status: ${value}`);
  return code;
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

  const prefectureCode = normalizeNumber(row.prefecture_code);
  const statusCode = normalizeNumber(row.status_code);
  const prefecture =
    typeof row.prefecture === "string"
      ? normalizeText(row.prefecture)
      : typeof prefectureCode === "number"
        ? getPrefectureName(prefectureCode)
        : undefined;
  const status = typeof statusCode === "number" ? getPubStatusValue(statusCode) : undefined;
  if (!prefecture || !status) return null;

  return {
    id: normalizeText(row.id),
    name: normalizeText(row.name),
    kana: normalizeOptionalText(row.kana),
    prefecture,
    city: normalizeOptionalText(row.city),
    municipalityCode: normalizeMunicipalityCode(row.municipality_code),
    address: normalizeText(row.address),
    latitude: normalizeNumber(row.latitude),
    longitude: normalizeNumber(row.longitude),
    websiteUrl: normalizeOptionalText(row.website_url),
    googleMapsUrl: normalizeOptionalText(row.google_maps_url),
    instagramUrl: normalizeOptionalText(row.instagram_url),
    tags: normalizeDbTags(row.tags),
    tagDisplayNames: normalizeDbTagDisplayNames(row.tag_display_names),
    status,
    statusDisplayName: normalizeOptionalText(row.status_display_name),
  };
}

function normalizeMunicipalityCode(value: unknown) {
  const normalized = normalizeOptionalText(value);
  return typeof normalized === "string" && /^\d{6}$/.test(normalized) ? normalized : undefined;
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

function normalizeDbTagDisplayNames(value: unknown) {
  const parsed = typeof value === "string" ? tryParseJson(value) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;

  const entries = Object.entries(parsed).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0,
  );
  return entries.length > 0
    ? Object.fromEntries(entries.map(([tag, displayName]) => [tag, displayName.trim()]))
    : undefined;
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function normalizeDbTags(value: unknown) {
  if (Array.isArray(value)) return value.map((tag) => normalizeText(tag));
  if (typeof value !== "string") return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((tag) => normalizeText(tag)) : value;
  } catch {
    return value;
  }
}
