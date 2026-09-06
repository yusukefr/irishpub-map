import { neon } from "@neondatabase/serverless";
import { DEFAULT_LOCALE, type Locale } from "@irishpub-map/shared/locale";
import { isContentCategory, type ContentKind, type PublishedContent } from "./types";

type DbContentRow = {
  kind: unknown;
  slug: unknown;
  category: unknown;
  published_at: unknown;
  title: unknown;
  summary: unknown;
  body_markdown: unknown;
};
let sqlClient: ReturnType<typeof neon> | null = null;

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
  if (!process.env.DATABASE_URL) return null;
  return getPublishedContentBySlugFromDatabase(kind, slug, locale);
}
/**
 * kindに属する公開済みContentだけを要求locale優先・日本語フォールバックで取得します。
 * @param {ContentKind} kind - 記事種別。
 * @param {Locale} locale - 優先locale。
 * @returns {Promise<readonly PublishedContent[]>} 公開Content一覧。
 */
export async function listPublishedContent(
  kind: ContentKind,
  locale: Locale = DEFAULT_LOCALE,
): Promise<readonly PublishedContent[]> {
  if (!process.env.DATABASE_URL) return [];
  return listPublishedContentFromDatabase(kind, locale);
}
async function getPublishedContentBySlugFromDatabase(kind: ContentKind, slug: string, locale: Locale) {
  const rows =
    (await getSql()`WITH locale_preference AS (SELECT ${locale}::text AS locale, 0 AS priority UNION ALL SELECT ${DEFAULT_LOCALE}, 1) SELECT entry.kind, entry.slug, entry.category, entry.published_at::text, translation.title, translation.summary, translation.body_markdown FROM content_entries AS entry JOIN LATERAL (SELECT value.title, value.summary, value.body_markdown FROM content_translations AS value JOIN locale_preference AS preference ON preference.locale = value.locale WHERE value.content_id = entry.id ORDER BY preference.priority LIMIT 1) AS translation ON TRUE WHERE entry.status = 'published' AND entry.kind = ${kind} AND entry.slug = ${slug}`) as DbContentRow[];
  return rows[0] ? parsePublishedContent(rows[0]) : null;
}
async function listPublishedContentFromDatabase(kind: ContentKind, locale: Locale) {
  const rows =
    (await getSql()`WITH locale_preference AS (SELECT ${locale}::text AS locale, 0 AS priority UNION ALL SELECT ${DEFAULT_LOCALE}, 1) SELECT entry.kind, entry.slug, entry.category, entry.published_at::text, translation.title, translation.summary, translation.body_markdown FROM content_entries AS entry JOIN LATERAL (SELECT value.title, value.summary, value.body_markdown FROM content_translations AS value JOIN locale_preference AS preference ON preference.locale = value.locale WHERE value.content_id = entry.id ORDER BY preference.priority LIMIT 1) AS translation ON TRUE WHERE entry.status = 'published' AND entry.kind = ${kind} ORDER BY entry.published_at DESC, entry.slug`) as DbContentRow[];
  return rows.map(parsePublishedContent);
}
function getSql() {
  sqlClient ??= neon(process.env.DATABASE_URL!);
  return sqlClient;
}
