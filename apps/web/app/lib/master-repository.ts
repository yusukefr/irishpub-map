import { neon } from "@neondatabase/serverless";
import { DEFAULT_LOCALE, type Locale } from "@irishpub-map/shared/locale";
import type {
  MunicipalityOption,
  PrefectureOption,
  PubStatusOption,
  TagOption,
} from "@irishpub-map/shared/admin-master";
import { getE2EMunicipalities, getE2EPrefectures, getE2EPubStatuses, getE2ETags } from "./e2e-test-fixtures";
import { isE2ETestMode } from "./e2e-test-mode";

type MasterLocale = Locale;
type DbRow = Record<string, unknown>;
let sqlClient: ReturnType<typeof neon> | null = null;

/**
 * 都道府県をJISコード順で取得します。
 * @param {MasterLocale} locale - 優先表示ロケール。
 * @returns {Promise<PrefectureOption[]>} 管理画面用の都道府県一覧。DB未設定時は空配列。
 */
export async function getPrefectures(locale: MasterLocale = DEFAULT_LOCALE): Promise<PrefectureOption[]> {
  if (isE2ETestMode()) return getE2EPrefectures(locale);
  if (!process.env.DATABASE_URL) return [];
  const rows = (await getSql()`
    WITH locale_preference AS (SELECT ${locale}::text AS locale, 0 AS priority UNION ALL SELECT ${DEFAULT_LOCALE}, 1)
    SELECT prefecture.code, translation.name
    FROM prefectures AS prefecture
    JOIN LATERAL (
      SELECT value.name
      FROM prefecture_translations AS value
      JOIN locale_preference AS preference ON preference.locale = value.locale
      WHERE value.prefecture_code = prefecture.code
      ORDER BY preference.priority
      LIMIT 1
    ) AS translation ON TRUE
    ORDER BY prefecture.code
  `) as DbRow[];
  return rows.map((row) => ({ code: requiredInteger(row.code), name: requiredText(row.name) }));
}

/**
 * 指定都道府県に所属する市区町村だけをコード順で取得します。
 * @param {number} prefectureCode - 絞り込む都道府県コード。
 * @param {MasterLocale} locale - 優先表示ロケール。
 * @returns {Promise<MunicipalityOption[]>} 管理画面用の市区町村一覧。DB未設定時は空配列。
 */
export async function getMunicipalitiesByPrefecture(
  prefectureCode: number,
  locale: MasterLocale = DEFAULT_LOCALE,
): Promise<MunicipalityOption[]> {
  if (isE2ETestMode()) return getE2EMunicipalities(prefectureCode, locale);
  if (!process.env.DATABASE_URL) return [];
  const rows = (await getSql()`
    WITH locale_preference AS (SELECT ${locale}::text AS locale, 0 AS priority UNION ALL SELECT ${DEFAULT_LOCALE}, 1)
    SELECT municipality.code, municipality.prefecture_code, translation.name
    FROM municipality_codes AS municipality
    JOIN LATERAL (
      SELECT value.name
      FROM municipality_translations AS value
      JOIN locale_preference AS preference ON preference.locale = value.locale
      WHERE value.municipality_code = municipality.code
      ORDER BY preference.priority
      LIMIT 1
    ) AS translation ON TRUE
    WHERE municipality.prefecture_code = ${prefectureCode}
    ORDER BY municipality.code::bigint
  `) as DbRow[];
  return rows.map((row) => ({
    code: requiredText(row.code),
    prefectureCode: requiredInteger(row.prefecture_code),
    name: requiredText(row.name),
  }));
}

/**
 * 登録済みタグを内部キー順で取得します。
 * @param {MasterLocale} locale - 優先表示ロケール。
 * @returns {Promise<TagOption[]>} 管理画面用のタグ一覧。翻訳がない場合は内部キーを表示名に使います。
 */
export async function getTags(locale: MasterLocale = DEFAULT_LOCALE): Promise<TagOption[]> {
  if (isE2ETestMode()) return getE2ETags(locale);
  if (!process.env.DATABASE_URL) return [];
  const rows = (await getSql()`
    WITH locale_preference AS (SELECT ${locale}::text AS locale, 0 AS priority UNION ALL SELECT ${DEFAULT_LOCALE}, 1)
    SELECT tag.id::text, tag.key, COALESCE(translation.name, tag.key) AS name
    FROM tags AS tag
    LEFT JOIN LATERAL (
      SELECT value.name
      FROM tag_translations AS value
      JOIN locale_preference AS preference ON preference.locale = value.locale
      WHERE value.tag_id = tag.id
      ORDER BY preference.priority
      LIMIT 1
    ) AS translation ON TRUE
    ORDER BY tag.key
  `) as DbRow[];
  return rows.map((row) => ({ id: requiredUuid(row.id), key: requiredText(row.key), name: requiredText(row.name) }));
}

/**
 * 登録済み営業ステータスをコード順で取得します。
 * @param {MasterLocale} locale - 優先表示ロケール。
 * @returns {Promise<PubStatusOption[]>} 管理画面用の営業ステータス一覧。DB未設定時は空配列。
 */
export async function getPubStatuses(locale: MasterLocale = DEFAULT_LOCALE): Promise<PubStatusOption[]> {
  if (isE2ETestMode()) return getE2EPubStatuses(locale);
  if (!process.env.DATABASE_URL) return [];
  const rows = (await getSql()`
    WITH locale_preference AS (SELECT ${locale}::text AS locale, 0 AS priority UNION ALL SELECT ${DEFAULT_LOCALE}, 1)
    SELECT status.code, status.key, translation.display_name AS name
    FROM pub_statuses AS status
    JOIN LATERAL (
      SELECT value.display_name
      FROM pub_status_translations AS value
      JOIN locale_preference AS preference ON preference.locale = value.locale
      WHERE value.status_code = status.code
      ORDER BY preference.priority
      LIMIT 1
    ) AS translation ON TRUE
    ORDER BY status.code
  `) as DbRow[];
  return rows.map((row) => ({
    code: requiredInteger(row.code),
    key: requiredText(row.key),
    name: requiredText(row.name),
  }));
}

function getSql() {
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL!);
  return sqlClient;
}

function requiredInteger(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(number)) throw new Error("Invalid master code returned from database.");
  return number;
}

function requiredText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid master text returned from database.");
  return value.trim();
}

function requiredUuid(value: unknown) {
  const text = requiredText(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error("Invalid master UUID returned from database.");
  }
  return text;
}
