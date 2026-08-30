import { neon } from "@neondatabase/serverless";
import { DEFAULT_LOCALE, type Locale } from "@irishpub-map/shared/locale";
import {
  ADMIN_PUB_PAGE_SIZE,
  type AdminPubListItem,
  type AdminPubListTag,
  type AdminPubPage,
  type AdminPubSearchCondition,
} from "@irishpub-map/shared/admin-pub";
import { getPrefectureName } from "@irishpub-map/shared/prefecture";
import { getPubStatusValue } from "@irishpub-map/shared/status";
import { asPubs, isPubId, type Pub } from "@irishpub-map/shared/pub";

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

type DbAdminPubListRow = DbPubRow & {
  prefecture_code: unknown;
  status_key: unknown;
  tag_items: unknown;
  updated_at: unknown;
  total_count: unknown;
};

type DbCountRow = {
  total_count: unknown;
};

type AdminPubCountCondition = {
  name: string | null;
  prefectureCode: number | null;
  municipalityCode: string | null;
  statusKey: AdminPubSearchCondition["statusKey"] | null;
  tagId: string | null;
  isPublished: boolean | null;
};

type PublicationSnapshotRow = {
  is_published: unknown;
  has_name: unknown;
  has_address: unknown;
  has_prefecture: unknown;
  has_municipality: unknown;
  has_latitude: unknown;
  has_longitude: unknown;
  has_status: unknown;
  has_tags: unknown;
};

/** 管理画面で公開状態と既存の店舗情報を同時に扱う取得モデルです。 */
export type AdminPub = Pub & { isPublished: boolean };

/** 公開条件を満たさない店舗の不足項目をAPIへ安全に伝える業務エラーです。 */
export class PubPublicationValidationError extends Error {
  /**
   * 公開条件不足を、表示値やDB内部情報を含まないフィールドコードで生成します。
   * @param {string[]} missingFields - 公開に必要だが不足している項目コード。
   */
  constructor(readonly missingFields: string[]) {
    super("Pub does not meet publication requirements.");
    this.name = "PubPublicationValidationError";
  }
}

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
 * @param {Locale} locale - 優先して取得する表示ロケール。
 * @returns {Promise<Pub[]>} 公開条件をSQLで適用した検証済み店舗一覧。
 */
export async function getPublishedPubs(locale: Locale = DEFAULT_LOCALE) {
  return parseDbPubs(await getDbPubRows(locale, false));
}

/**
 * 管理者向けに公開・非公開の両方を公開状態付きで取得します。
 * @param {Locale} locale - 優先して取得する表示ロケール。
 * @returns {Promise<AdminPub[]>} 公開状態を含む検証済み店舗一覧。
 */
export async function getAdminPubs(locale: Locale = DEFAULT_LOCALE) {
  return parseDbAdminPubs(await getDbPubRows(locale, true));
}

/**
 * 管理者向け店舗を複数条件のAND検索と固定件数ページングで取得します。
 * @param {AdminPubSearchCondition} condition - 検証済み検索条件。
 * @param {Locale} locale - 優先して取得する表示ロケール。
 * @returns {Promise<AdminPubPage>} 公開・非公開を含む管理店舗ページ。
 */
export async function getAdminPubPage(
  condition: AdminPubSearchCondition,
  locale: Locale = DEFAULT_LOCALE,
): Promise<AdminPubPage> {
  if (!isDatabaseConfigured()) return { pubs: [], total: 0, page: condition.page, pageSize: ADMIN_PUB_PAGE_SIZE };

  const name = condition.name ?? null;
  const prefectureCode = condition.prefectureCode ?? null;
  const municipalityCode = condition.municipalityCode ?? null;
  const statusKey = condition.statusKey ?? null;
  const tagId = condition.tagId ?? null;
  const isPublished = condition.isPublished ?? null;
  const offset = (condition.page - 1) * ADMIN_PUB_PAGE_SIZE;
  const rows = (await getSql()`
    WITH locale_preference AS (SELECT ${locale}::text AS locale, 0 AS priority UNION ALL SELECT ${DEFAULT_LOCALE}, 1)
    SELECT p.id::text, pt.name, pt.name_reading AS kana, p.prefecture_code, pref.name AS prefecture,
      mt.name AS city, p.municipality_code, pt.address, p.latitude, p.longitude, p.website_url,
      p.google_maps_url, p.instagram_url, p.status_code, status.key AS status_key,
      st.display_name AS status_display_name, p.is_published, p.updated_at,
      COALESCE(array_agg(tag.key ORDER BY tag.key) FILTER (WHERE tag.key IS NOT NULL), '{}') AS tags,
      COALESCE(jsonb_object_agg(tag.key, COALESCE(tag_translation.name, tag.key)) FILTER (WHERE tag.key IS NOT NULL), '{}'::jsonb) AS tag_display_names,
      COALESCE(jsonb_agg(jsonb_build_object('id', tag.id::text, 'key', tag.key, 'name', COALESCE(tag_translation.name, tag.key)) ORDER BY tag.key)
        FILTER (WHERE tag.id IS NOT NULL), '[]'::jsonb) AS tag_items,
      COUNT(*) OVER()::int AS total_count
    FROM pubs AS p
    JOIN LATERAL (SELECT name, name_reading, address FROM pub_translations AS value JOIN locale_preference AS preference ON preference.locale=value.locale WHERE value.pub_id=p.id ORDER BY preference.priority LIMIT 1) AS pt ON TRUE
    LEFT JOIN LATERAL (SELECT name FROM prefecture_translations AS value JOIN locale_preference AS preference ON preference.locale=value.locale WHERE value.prefecture_code=p.prefecture_code ORDER BY preference.priority LIMIT 1) AS pref ON TRUE
    LEFT JOIN LATERAL (SELECT name FROM municipality_translations AS value JOIN locale_preference AS preference ON preference.locale=value.locale WHERE value.municipality_code=p.municipality_code ORDER BY preference.priority LIMIT 1) AS mt ON TRUE
    LEFT JOIN pub_statuses AS status ON status.code=p.status_code
    LEFT JOIN LATERAL (SELECT display_name FROM pub_status_translations AS value JOIN locale_preference AS preference ON preference.locale=value.locale WHERE value.status_code=p.status_code ORDER BY preference.priority LIMIT 1) AS st ON TRUE
    LEFT JOIN pub_tags AS pub_tag ON pub_tag.pub_id=p.id
    LEFT JOIN tags AS tag ON tag.id=pub_tag.tag_id
    LEFT JOIN LATERAL (SELECT name FROM tag_translations AS value JOIN locale_preference AS preference ON preference.locale=value.locale WHERE value.tag_id=tag.id ORDER BY preference.priority LIMIT 1) AS tag_translation ON TRUE
    WHERE (${name}::text IS NULL OR EXISTS (SELECT 1 FROM pub_translations AS search_name WHERE search_name.pub_id=p.id AND search_name.locale='ja' AND search_name.name ILIKE '%' || ${name} || '%'))
      AND (${prefectureCode}::int IS NULL OR p.prefecture_code=${prefectureCode})
      AND (${municipalityCode}::text IS NULL OR p.municipality_code=${municipalityCode})
      AND (${statusKey}::text IS NULL OR status.key=${statusKey})
      AND (${tagId}::uuid IS NULL OR EXISTS (SELECT 1 FROM pub_tags AS search_tag WHERE search_tag.pub_id=p.id AND search_tag.tag_id=${tagId}::uuid))
      AND (${isPublished}::boolean IS NULL OR p.is_published=${isPublished})
    GROUP BY p.id, pt.name, pt.name_reading, pref.name, mt.name, pt.address, status.key, st.display_name
    ORDER BY p.updated_at DESC, pt.name, p.id
    LIMIT ${ADMIN_PUB_PAGE_SIZE} OFFSET ${offset}
  `) as DbAdminPubListRow[];
  const total =
    rows.length > 0
      ? requiredNonNegativeInteger(rows[0].total_count)
      : await getAdminPubCount(locale, { name, prefectureCode, municipalityCode, statusKey, tagId, isPublished });

  return {
    pubs: rows.map(toAdminPubListItem),
    total,
    page: condition.page,
    pageSize: ADMIN_PUB_PAGE_SIZE,
  };
}

async function getAdminPubCount(locale: string, condition: AdminPubCountCondition) {
  const rows = (await getSql()`
    WITH locale_preference AS (SELECT ${locale}::text AS locale, 0 AS priority UNION ALL SELECT ${DEFAULT_LOCALE}, 1)
    SELECT COUNT(*)::int AS total_count
    FROM pubs AS p
    JOIN LATERAL (SELECT 1 FROM pub_translations AS value JOIN locale_preference AS preference ON preference.locale=value.locale WHERE value.pub_id=p.id ORDER BY preference.priority LIMIT 1) AS pt ON TRUE
    LEFT JOIN pub_statuses AS status ON status.code=p.status_code
    WHERE (${condition.name ?? null}::text IS NULL OR EXISTS (SELECT 1 FROM pub_translations AS search_name WHERE search_name.pub_id=p.id AND search_name.locale='ja' AND search_name.name ILIKE '%' || ${condition.name ?? null} || '%'))
      AND (${condition.prefectureCode ?? null}::int IS NULL OR p.prefecture_code=${condition.prefectureCode ?? null})
      AND (${condition.municipalityCode ?? null}::text IS NULL OR p.municipality_code=${condition.municipalityCode ?? null})
      AND (${condition.statusKey ?? null}::text IS NULL OR status.key=${condition.statusKey ?? null})
      AND (${condition.tagId ?? null}::uuid IS NULL OR EXISTS (SELECT 1 FROM pub_tags AS search_tag WHERE search_tag.pub_id=p.id AND search_tag.tag_id=${condition.tagId ?? null}::uuid))
      AND (${condition.isPublished ?? null}::boolean IS NULL OR p.is_published=${condition.isPublished ?? null})
  `) as DbCountRow[];
  if (rows.length !== 1) throw new Error("Invalid admin pub count returned from database.");
  return requiredNonNegativeInteger(rows[0].total_count);
}

/**
 * 対象店舗の現在値を確認し、公開時だけ公開必須条件を満たす場合に状態を更新します。
 * @param {string} id - 対象店舗UUID。
 * @param {boolean} isPublished - 更新後の公開状態。
 * @returns {Promise<{ id: string; isPublished: boolean; unchanged: boolean } | null>} 更新結果、または対象なし。
 */
export async function setAdminPubPublication(id: string, isPublished: boolean) {
  const sql = getRequiredSql();
  const snapshot = await getPublicationSnapshot(sql, id);
  if (!snapshot) return null;
  if (snapshot.isPublished === isPublished) return { id, isPublished, unchanged: true };
  if (isPublished && snapshot.missingFields.length > 0) {
    throw new PubPublicationValidationError(snapshot.missingFields);
  }

  const rows = (await sql`
    UPDATE pubs AS pub
    SET is_published=${isPublished}, updated_at=NOW()
    WHERE pub.id=${id}::uuid
      AND (
        ${isPublished}=FALSE OR (
          pub.prefecture_code IS NOT NULL
          AND pub.municipality_code IS NOT NULL
          AND pub.latitude IS NOT NULL
          AND pub.longitude IS NOT NULL
          AND pub.status_code IS NOT NULL
          AND EXISTS (SELECT 1 FROM pub_translations AS translation WHERE translation.pub_id=pub.id AND translation.locale='ja' AND btrim(translation.name)<>'' AND translation.address IS NOT NULL AND btrim(translation.address)<>'')
          AND EXISTS (SELECT 1 FROM municipality_codes AS municipality WHERE municipality.code=pub.municipality_code AND municipality.prefecture_code=pub.prefecture_code)
          AND EXISTS (SELECT 1 FROM prefecture_translations AS translation WHERE translation.prefecture_code=pub.prefecture_code AND translation.locale='ja' AND btrim(translation.name)<>'')
          AND EXISTS (SELECT 1 FROM municipality_translations AS translation WHERE translation.municipality_code=pub.municipality_code AND translation.locale='ja' AND btrim(translation.name)<>'')
          AND EXISTS (SELECT 1 FROM pub_status_translations AS translation WHERE translation.status_code=pub.status_code AND translation.locale='ja' AND btrim(translation.display_name)<>'')
          AND NOT EXISTS (
            SELECT 1 FROM pub_tags AS pub_tag
            LEFT JOIN tag_translations AS translation
              ON translation.tag_id=pub_tag.tag_id
              AND translation.locale='ja'
            WHERE pub_tag.pub_id=pub.id
              AND NULLIF(btrim(translation.name), '') IS NULL
          )
        )
      )
    RETURNING pub.id::text
  `) as Array<{ id: string }>;
  if (rows.length === 1) return { id, isPublished, unchanged: false };

  const current = await getPublicationSnapshot(sql, id);
  if (!current) return null;
  throw new PubPublicationValidationError(current.missingFields);
}

async function getPublicationSnapshot(sql: ReturnType<typeof neon>, id: string) {
  const rows = (await sql`
    SELECT pub.is_published,
      EXISTS (SELECT 1 FROM pub_translations AS translation WHERE translation.pub_id=pub.id AND translation.locale='ja' AND btrim(translation.name)<>'') AS has_name,
      EXISTS (SELECT 1 FROM pub_translations AS translation WHERE translation.pub_id=pub.id AND translation.locale='ja' AND translation.address IS NOT NULL AND btrim(translation.address)<>'') AS has_address,
      (pub.prefecture_code IS NOT NULL AND EXISTS (SELECT 1 FROM prefecture_translations AS translation WHERE translation.prefecture_code=pub.prefecture_code AND translation.locale='ja' AND btrim(translation.name)<>'')) AS has_prefecture,
      (pub.municipality_code IS NOT NULL AND EXISTS (SELECT 1 FROM municipality_codes AS municipality WHERE municipality.code=pub.municipality_code AND municipality.prefecture_code=pub.prefecture_code) AND EXISTS (SELECT 1 FROM municipality_translations AS translation WHERE translation.municipality_code=pub.municipality_code AND translation.locale='ja' AND btrim(translation.name)<>'')) AS has_municipality,
      pub.latitude IS NOT NULL AS has_latitude,
      pub.longitude IS NOT NULL AS has_longitude,
      (pub.status_code IS NOT NULL AND EXISTS (SELECT 1 FROM pub_status_translations AS translation WHERE translation.status_code=pub.status_code AND translation.locale='ja' AND btrim(translation.display_name)<>'')) AS has_status,
      NOT EXISTS (
        SELECT 1 FROM pub_tags AS pub_tag
        LEFT JOIN tag_translations AS translation
          ON translation.tag_id=pub_tag.tag_id
          AND translation.locale='ja'
        WHERE pub_tag.pub_id=pub.id
          AND NULLIF(btrim(translation.name), '') IS NULL
      ) AS has_tags
    FROM pubs AS pub
    WHERE pub.id=${id}::uuid
  `) as PublicationSnapshotRow[];
  if (rows.length === 0) return null;
  const row = rows[0];
  if (typeof row.is_published !== "boolean") throw new Error("Invalid publication state returned from database.");
  const checks = [
    ["name", row.has_name],
    ["address", row.has_address],
    ["prefecture", row.has_prefecture],
    ["municipality", row.has_municipality],
    ["latitude", row.has_latitude],
    ["longitude", row.has_longitude],
    ["status", row.has_status],
    ["tags", row.has_tags],
  ] as const;
  if (checks.some(([, value]) => typeof value !== "boolean"))
    throw new Error("Invalid publication checks returned from database.");
  return { isPublished: row.is_published, missingFields: checks.filter(([, value]) => !value).map(([field]) => field) };
}

async function getDbPubRows(locale: string, includeUnpublished: boolean) {
  if (!isDatabaseConfigured()) return [];

  const sql = getSql();
  const rows = (await sql`
    WITH locale_preference AS (SELECT ${locale}::text AS locale, 0 AS priority UNION ALL SELECT ${DEFAULT_LOCALE}, 1)
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

function getRequiredSql() {
  if (!isDatabaseConfigured()) throw new Error("Database is not configured.");
  return getSql();
}

function getSql() {
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL!);
  return sqlClient;
}

function toPub(value: DbPubRow): Pub {
  const row = normalizeDbRow(value);
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

function toAdminPubListItem(row: DbAdminPubListRow): AdminPubListItem {
  const id = normalizeText(row.id);
  const name = normalizeText(row.name);
  const prefectureCode = nullablePositiveInteger(row.prefecture_code);
  const statusCode = nullablePositiveInteger(row.status_code);
  const status = normalizeOptionalText(row.status_key);
  const updatedAt = normalizeDate(row.updated_at);
  const totalCount = requiredNonNegativeInteger(row.total_count);
  if (
    typeof id !== "string" ||
    !isPubId(id) ||
    typeof name !== "string" ||
    !name ||
    typeof row.is_published !== "boolean" ||
    (status !== undefined &&
      (typeof status !== "string" || !["open", "temporarily_closed", "closed", "unknown"].includes(status))) ||
    totalCount < 0
  ) {
    throw new Error("Invalid admin pub list row.");
  }
  return {
    id,
    name,
    kana: nullableText(row.kana),
    prefecture: nullableText(row.prefecture),
    city: nullableText(row.city),
    municipalityCode: nullableMunicipalityCode(row.municipality_code),
    address: nullableText(row.address),
    latitude: nullableNumber(row.latitude),
    longitude: nullableNumber(row.longitude),
    websiteUrl: nullableText(row.website_url),
    googleMapsUrl: nullableText(row.google_maps_url),
    instagramUrl: nullableText(row.instagram_url),
    tags: requiredTextArray(row.tags),
    tagDisplayNames: normalizeDbTagDisplayNames(row.tag_display_names) ?? {},
    status: (status as Pub["status"] | undefined) ?? null,
    prefectureCode,
    statusCode,
    statusDisplayName: nullableText(row.status_display_name),
    tagItems: normalizeAdminPubListTags(row.tag_items),
    isPublished: row.is_published,
    updatedAt,
  };
}

function normalizeAdminPubListTags(value: unknown): AdminPubListTag[] {
  const parsed = typeof value === "string" ? tryParseJson(value) : value;
  if (!Array.isArray(parsed)) throw new Error("Invalid admin pub tag list.");
  return parsed.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid admin pub tag.");
    const tag = item as Record<string, unknown>;
    const id = normalizeText(tag.id);
    const key = normalizeText(tag.key);
    const name = normalizeText(tag.name);
    if (
      typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
      typeof key !== "string" ||
      !key ||
      typeof name !== "string" ||
      !name
    ) {
      throw new Error("Invalid admin pub tag.");
    }
    return { id, key, name };
  });
}

function requiredPositiveInteger(value: unknown) {
  const normalized = normalizeNumber(value);
  if (!Number.isInteger(normalized) || (normalized as number) < 1) throw new Error("Invalid positive integer.");
  return normalized as number;
}

function nullablePositiveInteger(value: unknown) {
  return value === null || value === undefined ? null : requiredPositiveInteger(value);
}

function nullableText(value: unknown) {
  const normalized = normalizeOptionalText(value);
  if (normalized === undefined) return null;
  if (typeof normalized !== "string") throw new Error("Invalid nullable text.");
  return normalized;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = normalizeNumber(value);
  if (typeof normalized !== "number" || !Number.isFinite(normalized)) throw new Error("Invalid nullable number.");
  return normalized;
}

function nullableMunicipalityCode(value: unknown) {
  if (value === null || value === undefined) return null;
  const normalized = normalizeMunicipalityCode(value);
  if (!normalized) throw new Error("Invalid nullable municipality code.");
  return normalized;
}

function requiredTextArray(value: unknown) {
  const normalized = normalizeDbTags(value);
  if (!Array.isArray(normalized) || normalized.some((item) => typeof item !== "string")) {
    throw new Error("Invalid text array.");
  }
  return normalized as string[];
}

function requiredNonNegativeInteger(value: unknown) {
  const normalized = normalizeNumber(value);
  if (!Number.isInteger(normalized) || (normalized as number) < 0) throw new Error("Invalid non-negative integer.");
  return normalized as number;
}

function normalizeDate(value: unknown) {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.valueOf())) throw new Error("Invalid admin pub updated date.");
  return date.toISOString();
}
