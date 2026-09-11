import { neon, type NeonQueryFunctionInTransaction } from "@neondatabase/serverless";
import type {
  AdminContent,
  AdminContentListItem,
  AdminContentWriteInput,
  ContentCategory,
  ContentKind,
  ContentStatus,
} from "@irishpub-map/shared/admin-content";
import { isContentCategory, isContentKind } from "@irishpub-map/shared/admin-content";
import { getE2EAdminContent, getE2EAdminContentList } from "./e2e-test-fixtures";
import { isE2ETestMode, rejectE2ETestMutation } from "./e2e-test-mode";

type DbRow = Record<string, unknown>;
/** 公開キャッシュを識別するContentの種類とslugです。 */
export type ContentIdentity = { kind: ContentKind; slug: string };
/** Content更新transactionの業務結果です。 */
export type AdminContentUpdateResult =
  | { code: "updated"; previous: ContentIdentity | null; previousStatus: ContentStatus }
  | { code: "not_found" }
  | { code: "publication_blocked" };
/** 公開状態変更とキャッシュ失効に必要な結果です。 */
export type AdminContentPublicationResult = {
  id: string;
  status: ContentStatus;
  unchanged: boolean;
  publishedAt: string | null;
  identity: ContentIdentity | null;
};

let sqlClient: ReturnType<typeof neon> | null = null;

/**
 * 管理用Editorial Contentを更新日時の降順で取得します。
 * @returns {Promise<AdminContentListItem[]>} DB未設定時は空配列、それ以外はDraftを含む一覧。
 */
export async function listAdminContent(): Promise<AdminContentListItem[]> {
  if (isE2ETestMode()) return getE2EAdminContentList();
  if (!process.env.DATABASE_URL) return [];
  const rows = (await getRequiredSql()`
    SELECT entry.id::text, entry.kind, entry.slug, entry.category, entry.status,
      entry.published_at, entry.created_at, entry.updated_at,
      COALESCE(ja.title, '') AS title_ja, COALESCE(en.title, '') AS title_en
    FROM content_entries AS entry
    LEFT JOIN content_translations AS ja ON ja.content_id = entry.id AND ja.locale = 'ja'
    LEFT JOIN content_translations AS en ON en.content_id = entry.id AND en.locale = 'en'
    ORDER BY entry.updated_at DESC, entry.id
  `) as DbRow[];
  return rows.map(toAdminContentListItem);
}

/**
 * 指定IDのEditorial Contentを日英翻訳とともに取得します。
 * @param {string} id - Content UUID。
 * @returns {Promise<AdminContent | null>} 対象が存在しない場合はnull。
 */
export async function getAdminContent(id: string): Promise<AdminContent | null> {
  if (isE2ETestMode()) return getE2EAdminContent(id);
  const rows = (await getRequiredSql()`
    SELECT entry.id::text, entry.kind, entry.slug, entry.category, entry.status,
      entry.published_at, entry.created_at, entry.updated_at,
      COALESCE(ja.title, '') AS title_ja, COALESCE(ja.summary, '') AS summary_ja,
      COALESCE(ja.body_markdown, '') AS body_markdown_ja,
      COALESCE(en.title, '') AS title_en, COALESCE(en.summary, '') AS summary_en,
      COALESCE(en.body_markdown, '') AS body_markdown_en
    FROM content_entries AS entry
    LEFT JOIN content_translations AS ja ON ja.content_id = entry.id AND ja.locale = 'ja'
    LEFT JOIN content_translations AS en ON en.content_id = entry.id AND en.locale = 'en'
    WHERE entry.id = ${id}::uuid
  `) as DbRow[];
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error("Invalid admin content detail result.");
  return toAdminContent(rows[0]);
}

/**
 * Editorial Content本体と日英翻訳を単一transactionでDraft作成します。
 * @param {string} id - Application Serviceで発行したUUID。
 * @param {AdminContentWriteInput} input - Draft Validation済み入力。
 * @returns {Promise<void>} transaction完了時に解決します。
 */
export async function insertAdminContent(id: string, input: AdminContentWriteInput): Promise<void> {
  rejectE2ETestMutation();
  const sql = getRequiredSql();
  await sql.transaction(
    (transaction) => [
      transaction`
        INSERT INTO content_entries (id, kind, slug, category, status)
        VALUES (${id}::uuid, ${input.kind}, ${input.slug}, ${input.category}, 'draft')
      `,
      translationUpsert(transaction, id, "ja", input),
      translationUpsert(transaction, id, "en", input),
    ],
    { isolationLevel: "ReadCommitted" },
  );
}

/**
 * 公開状態を維持し、Content本体と日英翻訳を単一transactionで全体更新します。
 * @param {string} id - 更新対象UUID。
 * @param {AdminContentWriteInput} input - Draft Validation済み入力。
 * @param {boolean} publishReady - 更新後入力が公開条件を満たす場合はtrue。
 * @returns {Promise<AdminContentUpdateResult>} 更新結果とキャッシュ失効に使う更新前識別子。
 */
export async function replaceAdminContent(
  id: string,
  input: AdminContentWriteInput,
  publishReady: boolean,
): Promise<AdminContentUpdateResult> {
  rejectE2ETestMutation();
  const sql = getRequiredSql();
  const [lockedRows, updatedRows] = (await sql.transaction(
    (transaction) => [
      transaction`
        SELECT kind, slug, status FROM content_entries
        WHERE id = ${id}::uuid FOR UPDATE
      `,
      transaction`
        UPDATE content_entries AS entry
        SET kind = ${input.kind}, slug = ${input.slug}, category = ${input.category}, updated_at = NOW()
        WHERE entry.id = ${id}::uuid
          AND (entry.status = 'draft' OR ${publishReady})
        RETURNING entry.id
      `,
      translationUpsert(transaction, id, "ja", input, publishReady),
      translationUpsert(transaction, id, "en", input, publishReady),
    ],
    { isolationLevel: "ReadCommitted" },
  )) as [DbRow[], DbRow[], DbRow[], DbRow[]];

  if (lockedRows.length === 0) return { code: "not_found" };
  if (updatedRows.length === 0) return { code: "publication_blocked" };
  const previousStatus = requiredStatus(lockedRows[0].status);
  return { code: "updated", previous: rowIdentity(lockedRows[0]), previousStatus };
}

/**
 * Editorial Contentの公開状態を行ロックと公開条件の再検証を伴って変更します。
 * @param {string} id - 対象UUID。
 * @param {ContentStatus} status - 変更後の公開状態。
 * @returns {Promise<AdminContentPublicationResult | null>} 対象なしはnull。
 */
export async function setAdminContentPublication(
  id: string,
  status: ContentStatus,
): Promise<AdminContentPublicationResult | null> {
  rejectE2ETestMutation();
  const sql = getRequiredSql();
  const [lockedRows, updatedRows] = (await sql.transaction(
    (transaction) => [
      transaction`
        SELECT kind, slug, status, published_at FROM content_entries
        WHERE id = ${id}::uuid FOR UPDATE
      `,
      transaction`
        UPDATE content_entries AS entry
        SET status = ${status},
          published_at = CASE WHEN ${status} = 'published' THEN NOW() ELSE NULL END,
          updated_at = NOW()
        WHERE entry.id = ${id}::uuid
          AND entry.status <> ${status}
          AND (
            ${status} = 'draft'
            OR (
              entry.kind IS NOT NULL AND btrim(entry.kind) <> ''
              AND entry.slug IS NOT NULL AND btrim(entry.slug) <> ''
              AND entry.category IS NOT NULL AND btrim(entry.category) <> ''
              AND NOT EXISTS (
                SELECT 1 FROM (VALUES ('ja'), ('en')) AS required(locale)
                WHERE NOT EXISTS (
                  SELECT 1 FROM content_translations AS translation
                  WHERE translation.content_id = entry.id
                    AND translation.locale = required.locale
                    AND btrim(translation.title) <> ''
                    AND btrim(translation.summary) <> ''
                    AND btrim(translation.body_markdown) <> ''
                )
              )
            )
          )
        RETURNING entry.id, entry.kind, entry.slug, entry.status, entry.published_at
      `,
    ],
    { isolationLevel: "ReadCommitted" },
  )) as [DbRow[], DbRow[]];

  if (lockedRows.length === 0) return null;
  const currentStatus = requiredStatus(lockedRows[0].status);
  const currentPublishedAt = nullableDate(lockedRows[0].published_at);
  if (currentStatus === status) {
    return { id, status, unchanged: true, publishedAt: currentPublishedAt, identity: rowIdentity(lockedRows[0]) };
  }
  if (updatedRows.length === 0) {
    return { id, status: currentStatus, unchanged: true, publishedAt: currentPublishedAt, identity: null };
  }
  return {
    id,
    status,
    unchanged: false,
    publishedAt: nullableDate(updatedRows[0].published_at),
    identity: rowIdentity(updatedRows[0]),
  };
}

/**
 * DATABASE_URLが設定されているかを返します。
 * @returns {boolean} DB接続設定がある場合はtrue。
 */
export function isContentDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function translationUpsert(
  transaction: NeonQueryFunctionInTransaction<boolean, boolean>,
  id: string,
  locale: "ja" | "en",
  input: AdminContentWriteInput,
  publishReady = true,
) {
  const translation = input.translations[locale];
  return transaction`
    INSERT INTO content_translations (content_id, locale, title, summary, body_markdown)
    SELECT ${id}::uuid, ${locale}, ${translation.title}, ${translation.summary}, ${translation.bodyMarkdown}
    WHERE EXISTS (
      SELECT 1 FROM content_entries AS entry
      WHERE entry.id = ${id}::uuid AND (entry.status = 'draft' OR ${publishReady})
    )
    ON CONFLICT (content_id, locale) DO UPDATE
    SET title = EXCLUDED.title, summary = EXCLUDED.summary,
      body_markdown = EXCLUDED.body_markdown, updated_at = NOW()
  `;
}

function getRequiredSql() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  sqlClient ??= neon(process.env.DATABASE_URL);
  return sqlClient;
}

function toAdminContent(row: DbRow): AdminContent {
  return {
    ...toAdminContentBase(row),
    translations: {
      ja: {
        title: requiredString(row.title_ja),
        summary: requiredString(row.summary_ja),
        bodyMarkdown: requiredString(row.body_markdown_ja),
      },
      en: {
        title: requiredString(row.title_en),
        summary: requiredString(row.summary_en),
        bodyMarkdown: requiredString(row.body_markdown_en),
      },
    },
  };
}

function toAdminContentListItem(row: DbRow): AdminContentListItem {
  return {
    ...toAdminContentBase(row),
    titleJa: requiredString(row.title_ja),
    titleEn: requiredString(row.title_en),
  };
}

function toAdminContentBase(row: DbRow) {
  return {
    id: requiredUuid(row.id),
    kind: nullableKind(row.kind),
    slug: nullableString(row.slug),
    category: nullableCategory(row.category),
    status: requiredStatus(row.status),
    publishedAt: nullableDate(row.published_at),
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

function rowIdentity(row: DbRow): ContentIdentity | null {
  const kind = nullableKind(row.kind);
  const slug = nullableString(row.slug);
  return kind && slug ? { kind, slug } : null;
}

function requiredString(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid text returned from database.");
  return value;
}

function nullableString(value: unknown) {
  return value === null || value === undefined ? null : requiredString(value);
}

function nullableKind(value: unknown): ContentKind | null {
  if (value === null || value === undefined) return null;
  const kind = requiredString(value);
  if (!isContentKind(kind)) throw new Error("Invalid content kind returned from database.");
  return kind;
}

function nullableCategory(value: unknown): ContentCategory | null {
  if (value === null || value === undefined) return null;
  const category = requiredString(value);
  if (!isContentCategory(category)) throw new Error("Invalid content category returned from database.");
  return category;
}

function requiredStatus(value: unknown): ContentStatus {
  if (value !== "draft" && value !== "published") throw new Error("Invalid content status returned from database.");
  return value;
}

function requiredUuid(value: unknown) {
  const id = requiredString(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Invalid UUID returned from database.");
  }
  return id;
}

function requiredDate(value: unknown) {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.valueOf())) throw new Error("Invalid date returned from database.");
  return date.toISOString();
}

function nullableDate(value: unknown) {
  return value === null || value === undefined ? null : requiredDate(value);
}
