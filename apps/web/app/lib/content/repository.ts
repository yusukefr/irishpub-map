import { neon } from "@neondatabase/serverless";
import { CONTENT_SLUG_MAX_LENGTH } from "@irishpub-map/shared/admin-content";
import { DEFAULT_LOCALE, type Locale } from "@irishpub-map/shared/locale";
import { getE2EPublishedContentBySlug, getE2EPublishedContentList } from "../e2e-test-fixtures";
import { isE2ETestMode } from "../e2e-test-mode";
import { getCachedPublishedContent, getCachedPublishedContentList } from "./cache";
import { isContentCategory, type ContentKind, type PublishedContent, type PublishedContentSummary } from "./types";

type DbContentSummaryRow = {
  kind: unknown;
  slug: unknown;
  category: unknown;
  published_at: unknown;
  title: unknown;
  summary: unknown;
};
type DbContentRow = DbContentSummaryRow & {
  body_markdown: unknown;
};
let sqlClient: ReturnType<typeof neon> | null = null;
const CONTENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/**
 * DB行を公開Contentへ変換します。
 * @param {DbContentRow} row - DBから返されたContent行。
 * @returns {PublishedContent} 検証済み公開Content。
 */
export function parsePublishedContent(row: DbContentRow): PublishedContent {
  if (
    (row.kind !== "guide" && row.kind !== "story") ||
    typeof row.slug !== "string" ||
    !isContentCategory(typeof row.category === "string" ? row.category : "") ||
    typeof row.title !== "string" ||
    typeof row.summary !== "string" ||
    typeof row.body_markdown !== "string" ||
    typeof row.published_at !== "string"
  )
    throw new Error("Invalid published content returned from database.");
  return {
    kind: row.kind,
    slug: row.slug,
    category: row.category as PublishedContent["category"],
    publishedAt: row.published_at,
    title: row.title,
    summary: row.summary,
    bodyMarkdown: row.body_markdown,
  };
}
/**
 * 公開済みContentだけを要求locale優先・日本語フォールバックで取得します。
 * @param {ContentKind} kind - 記事種別。
 * @param {string} slug - 記事slug。
 * @param {Locale} locale - 優先locale。
 * @returns {Promise<PublishedContent | null>} 公開Content。
 */
export async function getPublishedContentBySlug(
  kind: ContentKind,
  slug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<PublishedContent | null> {
  if (slug.length > CONTENT_SLUG_MAX_LENGTH) return null;
  if (isE2ETestMode()) return getE2EPublishedContentBySlug(kind, slug, locale);
  if (!process.env.DATABASE_URL) return null;
  return getCachedPublishedContent(kind, slug, locale, () => getPublishedContentBySlugFromDatabase(kind, slug, locale));
}
/**
 * 公開済みContentだけをID指定で要求locale優先・日本語フォールバックして取得します。
 * @param {string} id Content UUID。
 * @param {Locale} locale 優先locale。
 * @returns {Promise<PublishedContent | null>} 不正ID・DB未設定・非公開・対象なしの場合はnull。
 */
export async function getPublishedContentById(
  id: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<PublishedContent | null> {
  if (!CONTENT_ID_PATTERN.test(id) || !process.env.DATABASE_URL) return null;
  return getPublishedContentByIdFromDatabase(id, locale);
}

/**
 * kindに属する公開済みContentだけを要求locale優先・日本語フォールバックで取得します。
 * @param {ContentKind} kind - 記事種別。
 * @param {Locale} locale - 優先locale。
 * @returns {Promise<readonly PublishedContentSummary[]>} 公開Content一覧メタデータ。
 */
export async function listPublishedContent(
  kind: ContentKind,
  locale: Locale = DEFAULT_LOCALE,
): Promise<readonly PublishedContentSummary[]> {
  if (isE2ETestMode()) return getE2EPublishedContentList(kind, locale);
  if (!process.env.DATABASE_URL) return [];
  return getCachedPublishedContentList(kind, locale, () => listPublishedContentFromDatabase(kind, locale));
}
async function getPublishedContentBySlugFromDatabase(kind: ContentKind, slug: string, locale: Locale) {
  const rows =
    (await getSql()`WITH locale_preference AS (SELECT ${locale}::text AS locale, 0 AS priority UNION ALL SELECT ${DEFAULT_LOCALE}, 1) SELECT entry.kind, entry.slug, entry.category, entry.published_at::text, translation.title, translation.summary, translation.body_markdown FROM content_entries AS entry JOIN LATERAL (SELECT value.title, value.summary, value.body_markdown FROM content_translations AS value JOIN locale_preference AS preference ON preference.locale = value.locale WHERE value.content_id = entry.id ORDER BY preference.priority LIMIT 1) AS translation ON TRUE WHERE entry.status = 'published' AND entry.kind = ${kind} AND entry.slug = ${slug}`) as DbContentRow[];
  return rows[0] ? parsePublishedContent(rows[0]) : null;
}
async function getPublishedContentByIdFromDatabase(id: string, locale: Locale) {
  const rows =
    (await getSql()`WITH locale_preference AS (SELECT ${locale}::text AS locale, 0 AS priority UNION ALL SELECT ${DEFAULT_LOCALE}, 1) SELECT entry.kind, entry.slug, entry.category, entry.published_at::text, translation.title, translation.summary, translation.body_markdown FROM content_entries AS entry JOIN LATERAL (SELECT value.title, value.summary, value.body_markdown FROM content_translations AS value JOIN locale_preference AS preference ON preference.locale = value.locale WHERE value.content_id = entry.id ORDER BY preference.priority LIMIT 1) AS translation ON TRUE WHERE entry.status = 'published' AND entry.id = ${id}::uuid`) as DbContentRow[];
  if (rows.length > 1) throw new Error("Invalid published content result.");
  return rows[0] ? parsePublishedContent(rows[0]) : null;
}

function parsePublishedContentSummary(row: DbContentSummaryRow): PublishedContentSummary {
  if (
    (row.kind !== "guide" && row.kind !== "story") ||
    typeof row.slug !== "string" ||
    !isContentCategory(typeof row.category === "string" ? row.category : "") ||
    typeof row.title !== "string" ||
    typeof row.summary !== "string" ||
    typeof row.published_at !== "string"
  )
    throw new Error("Invalid published content returned from database.");
  return {
    kind: row.kind,
    slug: row.slug,
    category: row.category as PublishedContentSummary["category"],
    publishedAt: row.published_at,
    title: row.title,
    summary: row.summary,
  };
}
async function listPublishedContentFromDatabase(kind: ContentKind, locale: Locale) {
  const rows =
    (await getSql()`WITH locale_preference AS (SELECT ${locale}::text AS locale, 0 AS priority UNION ALL SELECT ${DEFAULT_LOCALE}, 1) SELECT entry.kind, entry.slug, entry.category, entry.published_at::text, translation.title, translation.summary FROM content_entries AS entry JOIN LATERAL (SELECT value.title, value.summary FROM content_translations AS value JOIN locale_preference AS preference ON preference.locale = value.locale WHERE value.content_id = entry.id ORDER BY preference.priority LIMIT 1) AS translation ON TRUE WHERE entry.status = 'published' AND entry.kind = ${kind} ORDER BY entry.published_at DESC, entry.slug`) as DbContentSummaryRow[];
  return rows.map(parsePublishedContentSummary);
}
function getSql() {
  sqlClient ??= neon(process.env.DATABASE_URL!);
  return sqlClient;
}
