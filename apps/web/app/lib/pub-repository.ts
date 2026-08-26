import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { getPrefectureCode, getPrefectureName } from "@irishpub-map/shared/prefecture";
import { getPubStatusCode, getPubStatusValue } from "@irishpub-map/shared/status";
import { asPubs, type Pub } from "@irishpub-map/shared/pub";
import { getTagLabel, normalizeTags } from "@irishpub-map/shared/tag";

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
  is_published: unknown;
};

/** 管理画面で公開状態と既存の店舗情報を同時に扱う取得モデルです。 */
export type AdminPub = Pub & { isPublished: boolean };

let sqlClient: ReturnType<typeof neon> | null = null;

/**
 * Neonへの接続設定があり、永続化を利用できるかを返します。
 * @returns {boolean} DB接続設定が存在する場合はtrue。
 */
export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * 公開中の店舗だけを、選択ロケールから日本語へフォールバックして取得します。
 * @param {string} locale - 優先して取得する表示ロケール。
 * @returns {Promise<Pub[]>} 公開条件をSQLで適用した検証済み店舗一覧。
 */
export async function getPublishedPubs(locale = "ja") {
  return parseDbPubs(await getDbPubRows(locale, false));
}

/**
 * 管理者向けに公開・非公開の両方を公開状態付きで取得します。
 * @param {string} locale - 優先して取得する表示ロケール。
 * @returns {Promise<AdminPub[]>} 公開状態を含む検証済み店舗一覧。
 */
export async function getAdminPubs(locale = "ja") {
  return parseDbAdminPubs(await getDbPubRows(locale, true));
}

async function getDbPubRows(locale: string, includeUnpublished: boolean) {
  if (!isDatabaseConfigured()) return [];

  const sql = getSql();
  const rows = (await sql`
    WITH locale_preference AS (SELECT ${locale}::text AS locale, 0 AS priority UNION ALL SELECT 'ja', 1)
    SELECT p.id::text, pt.name, pt.name_reading AS kana, p.prefecture_code, pref.name AS prefecture, mt.name AS city, p.municipality_code, pt.address, p.latitude, p.longitude,
      p.website_url, p.google_maps_url, p.instagram_url, p.status_code, st.display_name AS status_display_name, p.is_published,
      COALESCE(array_agg(t.key ORDER BY t.key) FILTER (WHERE t.key IS NOT NULL), '{}') AS tags,
      COALESCE(jsonb_object_agg(t.key, tt.name) FILTER (WHERE t.key IS NOT NULL), '{}'::jsonb) AS tag_display_names
    FROM pubs p
    JOIN LATERAL (SELECT name, name_reading, address FROM pub_translations tr JOIN locale_preference lp ON lp.locale=tr.locale WHERE tr.pub_id=p.id ORDER BY lp.priority LIMIT 1) pt ON TRUE
    JOIN LATERAL (SELECT tr.name FROM prefecture_translations tr JOIN locale_preference lp ON lp.locale=tr.locale WHERE tr.prefecture_code=p.prefecture_code ORDER BY lp.priority LIMIT 1) pref ON TRUE
    LEFT JOIN LATERAL (SELECT tr.name FROM municipality_translations tr JOIN locale_preference lp ON lp.locale=tr.locale WHERE tr.municipality_code=p.municipality_code ORDER BY lp.priority LIMIT 1) mt ON TRUE
    JOIN LATERAL (SELECT display_name FROM pub_status_translations tr JOIN locale_preference lp ON lp.locale=tr.locale WHERE tr.status_code=p.status_code ORDER BY lp.priority LIMIT 1) st ON TRUE
    LEFT JOIN pub_tags ptag ON ptag.pub_id=p.id LEFT JOIN tags t ON t.id=ptag.tag_id
    LEFT JOIN LATERAL (SELECT name FROM tag_translations tr JOIN locale_preference lp ON lp.locale=tr.locale WHERE tr.tag_id=t.id ORDER BY lp.priority LIMIT 1) tt ON TRUE
    WHERE p.is_published = TRUE OR ${includeUnpublished}
    GROUP BY p.id, pt.name, pt.name_reading, pref.name, mt.name, pt.address, st.display_name
    ORDER BY p.municipality_code::bigint, pt.name, p.id
  `) as DbPubRow[];
  return rows;
}

/**
 * 外部入力を店舗型として検証し、新しいUUIDを付けて独立カラムへ永続化します。
 * @param {unknown} value - 検証・登録する外部入力。
 * @returns {Promise<AdminPub>} 公開状態を含む登録した店舗。
 */
export async function createPub(value: unknown) {
  const pub = toPub(value, randomUUID());
  const sql = getRequiredSql();
  await insertPub(sql, pub);
  return (await getPubById(sql, pub.id))!;
}

/**
 * 外部入力を既存UUIDの店舗型として検証し、独立カラムを更新します。
 * @param {string} id - 更新対象の店舗ID。
 * @param {unknown} value - 検証・保存する店舗データ。
 * @returns {Promise<AdminPub | null>} 公開状態を含む更新した店舗、または対象がない場合のnull。
 */
export async function updatePub(id: string, value: unknown) {
  const pub = toPub(value, id);
  const sql = getRequiredSql();
  const municipalityCode = await resolveMunicipalityCode(sql, pub);
  const rows = (await sql`
    UPDATE pubs
    SET prefecture_code = ${getRequiredPrefectureCode(pub.prefecture)}, municipality_code = ${municipalityCode},
      latitude = ${pub.latitude}, longitude = ${pub.longitude}, website_url = ${toNullable(pub.websiteUrl)},
      google_maps_url = ${toNullable(pub.googleMapsUrl)}, instagram_url = ${toNullable(pub.instagramUrl)},
      status_code = ${getRequiredStatusCode(pub.status)}, updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id
  `) as Array<{ id: string }>;
  if (rows.length !== 1) return null;
  await upsertJapanesePubTranslation(sql, pub);
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

async function insertPub(sql: ReturnType<typeof neon>, pub: Pub) {
  const municipalityCode = await resolveMunicipalityCode(sql, pub);
  await sql`
    INSERT INTO pubs (id, prefecture_code, municipality_code, latitude, longitude, website_url, google_maps_url, instagram_url, status_code)
    VALUES (${pub.id}::uuid, ${getRequiredPrefectureCode(pub.prefecture)}, ${municipalityCode}, ${pub.latitude}, ${pub.longitude}, ${toNullable(pub.websiteUrl)}, ${toNullable(pub.googleMapsUrl)}, ${toNullable(pub.instagramUrl)}, ${getRequiredStatusCode(pub.status)})
  `;
  await upsertJapanesePubTranslation(sql, pub);
  await replacePubTags(sql, pub.id, pub.tags);
}

async function replacePubTags(sql: ReturnType<typeof neon>, pubId: string, tags: string[]) {
  await sql`DELETE FROM pub_tags WHERE pub_id = ${pubId}::uuid`;
  for (const tag of normalizeTags(tags)) {
    const tagRows = (await sql`
      INSERT INTO tags (key)
      VALUES (${tag})
      ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key
      RETURNING id
    `) as Array<{ id: string }>;
    if (tagRows.length !== 1) throw new Error("Could not resolve tag master record.");
    await sql`INSERT INTO tag_translations (tag_id, locale, name) VALUES (${tagRows[0].id}::uuid, 'ja', ${getTagLabel(tag)}) ON CONFLICT (tag_id, locale) DO UPDATE SET name = EXCLUDED.name`;
    await sql`INSERT INTO pub_tags (pub_id, tag_id) VALUES (${pubId}::uuid, ${tagRows[0].id}::uuid) ON CONFLICT (pub_id, tag_id) DO NOTHING`;
  }
}

async function getPubById(_sql: ReturnType<typeof neon>, id: string) {
  return (await getAdminPubs()).find((pub) => pub.id === id) ?? null;
}

async function resolveMunicipalityCode(sql: ReturnType<typeof neon>, pub: Pub) {
  const rows = (await sql`
    SELECT m.code FROM municipality_codes m
    JOIN municipality_translations mt ON mt.municipality_code = m.code AND mt.locale = 'ja'
    WHERE m.prefecture_code = ${getRequiredPrefectureCode(pub.prefecture)} AND mt.name = ${pub.city ?? ""}
  `) as Array<{ code: string }>;
  if (rows.length !== 1) throw new Error("Could not resolve municipality code.");
  return rows[0].code;
}

async function upsertJapanesePubTranslation(sql: ReturnType<typeof neon>, pub: Pub) {
  await sql`
    INSERT INTO pub_translations (pub_id, locale, name, name_reading, address)
    VALUES (${pub.id}::uuid, 'ja', ${pub.name}, ${toNullable(pub.kana)}, ${pub.address})
    ON CONFLICT (pub_id, locale) DO UPDATE SET name = EXCLUDED.name, name_reading = EXCLUDED.name_reading, address = EXCLUDED.address, updated_at = NOW()
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

/**
 * DB行を管理用店舗へ変換し、公開状態が不正な行を公開情報と同様に拒否します。
 * @param {unknown[]} rows - DBドライバーから返された行。
 * @returns {AdminPub[]} 公開状態を含む検証済み管理店舗一覧。
 */
export function parseDbAdminPubs(rows: unknown[]) {
  const pubs: AdminPub[] = [];
  let skippedCount = 0;

  for (const value of rows) {
    try {
      const row = value as DbPubRow;
      if (typeof row.is_published !== "boolean") throw new Error("Invalid publication state.");
      pubs.push({ ...toPub(row), isPublished: row.is_published });
    } catch {
      skippedCount += 1;
    }
  }

  if (skippedCount > 0) {
    console.error("Skipped invalid admin pub rows from the database.", {
      skippedCount,
      totalCount: rows.length,
    });
  }

  if (rows.length > 0 && pubs.length === 0) {
    throw new Error("No valid admin pub data found in database.");
  }

  return pubs;
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
