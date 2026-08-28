import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { AdminTag, CreateAdminTagInput, UpdateAdminTagInput } from "@irishpub-map/shared/admin-tag";

type DbRow = Record<string, unknown>;
type TagRepositoryErrorCode = "conflict" | "in_use" | "not_found";
let sqlClient: ReturnType<typeof neon> | null = null;

/** タグ管理で利用者へ一般化して返せるRepository上の業務エラーです。 */
export class TagRepositoryError extends Error {
  /**
   * APIへ安全に変換可能なRepositoryエラーを生成します。
   * @param {TagRepositoryErrorCode} code - APIレスポンスへ変換するエラー種別。
   */
  constructor(readonly code: TagRepositoryErrorCode) {
    super(`Admin tag repository error: ${code}`);
    this.name = "TagRepositoryError";
  }
}

/**
 * 日英表示名と使用店舗数を含む管理タグ一覧を内部キー順で取得します。
 * @returns {Promise<AdminTag[]>} DB未設定時は空配列、それ以外は検証済み管理タグ一覧。
 */
export async function getAdminTags(): Promise<AdminTag[]> {
  if (!process.env.DATABASE_URL) return [];
  const rows = (await getSql()`
    SELECT tag.id::text, tag.key,
      MAX(translation.name) FILTER (WHERE translation.locale = 'ja') AS name_ja,
      MAX(translation.name) FILTER (WHERE translation.locale = 'en') AS name_en,
      COUNT(DISTINCT pub_tag.pub_id)::int AS pub_count
    FROM tags AS tag
    LEFT JOIN tag_translations AS translation ON translation.tag_id = tag.id AND translation.locale IN ('ja', 'en')
    LEFT JOIN pub_tags AS pub_tag ON pub_tag.tag_id = tag.id
    GROUP BY tag.id, tag.key
    ORDER BY tag.key
  `) as DbRow[];
  return rows.map(toAdminTag);
}

/**
 * タグ本体と必須の日本語翻訳、任意の英語翻訳を単一transactionで登録します。
 * @param {CreateAdminTagInput} input - 共有Validationを通過したタグ入力。
 * @returns {Promise<AdminTag>} 登録した未使用タグ。
 */
export async function createAdminTag(input: CreateAdminTagInput): Promise<AdminTag> {
  const sql = getRequiredSql();
  if (await hasTagConflict(sql, input, null)) throw new TagRepositoryError("conflict");
  const id = randomUUID();
  try {
    await sql.transaction((transaction) => {
      const queries = [
        transaction`INSERT INTO tags (id, key) VALUES (${id}::uuid, ${input.key})`,
        transaction`INSERT INTO tag_translations (tag_id, locale, name) VALUES (${id}::uuid, 'ja', ${input.nameJa})`,
      ];
      if (input.nameEn) {
        queries.push(
          transaction`INSERT INTO tag_translations (tag_id, locale, name) VALUES (${id}::uuid, 'en', ${input.nameEn})`,
        );
      }
      return queries;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new TagRepositoryError("conflict");
    throw error;
  }
  return { id, key: input.key, nameJa: input.nameJa, nameEn: input.nameEn, pubCount: 0 };
}

/**
 * 内部キーを維持したまま日英表示名をtransactionで更新し、空の英語翻訳は削除します。
 * @param {string} id - 更新対象タグのUUID。
 * @param {UpdateAdminTagInput} input - 共有Validationを通過した表示名入力。
 * @returns {Promise<AdminTag>} 更新後の管理タグ。
 */
export async function updateAdminTag(id: string, input: UpdateAdminTagInput): Promise<AdminTag> {
  const sql = getRequiredSql();
  const current = await getAdminTagById(sql, id);
  if (!current) throw new TagRepositoryError("not_found");
  if (await hasTagConflict(sql, input, id)) throw new TagRepositoryError("conflict");
  try {
    await sql.transaction((transaction) => {
      const queries = [
        transaction`
          INSERT INTO tag_translations (tag_id, locale, name) VALUES (${id}::uuid, 'ja', ${input.nameJa})
          ON CONFLICT (tag_id, locale) DO UPDATE SET name = EXCLUDED.name
        `,
      ];
      queries.push(
        input.nameEn
          ? transaction`
              INSERT INTO tag_translations (tag_id, locale, name) VALUES (${id}::uuid, 'en', ${input.nameEn})
              ON CONFLICT (tag_id, locale) DO UPDATE SET name = EXCLUDED.name
            `
          : transaction`DELETE FROM tag_translations WHERE tag_id = ${id}::uuid AND locale = 'en'`,
      );
      return queries;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new TagRepositoryError("conflict");
    throw error;
  }
  return { ...current, nameJa: input.nameJa, nameEn: input.nameEn };
}

/**
 * 対象タグをロックし、店舗から未使用の場合だけ削除します。店舗関連自体は変更しません。
 * @param {string} id - 削除対象タグのUUID。
 * @returns {Promise<void>} 未使用タグを削除した場合に完了します。
 */
export async function deleteAdminTag(id: string): Promise<void> {
  const sql = getRequiredSql();
  const [lockedRows, usageRows, deletedRows] = (await sql.transaction((transaction) => [
    transaction`SELECT id FROM tags WHERE id = ${id}::uuid FOR UPDATE`,
    transaction`SELECT COUNT(*)::int AS pub_count FROM pub_tags WHERE tag_id = ${id}::uuid`,
    transaction`
      DELETE FROM tags AS tag
      WHERE tag.id = ${id}::uuid
        AND NOT EXISTS (SELECT 1 FROM pub_tags AS pub_tag WHERE pub_tag.tag_id = tag.id)
      RETURNING tag.id
    `,
  ])) as [DbRow[], DbRow[], DbRow[]];
  if (lockedRows.length === 0) throw new TagRepositoryError("not_found");
  if (requiredNonNegativeInteger(usageRows[0]?.pub_count) > 0) throw new TagRepositoryError("in_use");
  if (deletedRows.length !== 1) throw new TagRepositoryError("in_use");
}

async function getAdminTagById(sql: ReturnType<typeof neon>, id: string) {
  const rows = (await sql`
    SELECT tag.id::text, tag.key,
      MAX(translation.name) FILTER (WHERE translation.locale = 'ja') AS name_ja,
      MAX(translation.name) FILTER (WHERE translation.locale = 'en') AS name_en,
      COUNT(DISTINCT pub_tag.pub_id)::int AS pub_count
    FROM tags AS tag
    LEFT JOIN tag_translations AS translation ON translation.tag_id = tag.id AND translation.locale IN ('ja', 'en')
    LEFT JOIN pub_tags AS pub_tag ON pub_tag.tag_id = tag.id
    WHERE tag.id = ${id}::uuid
    GROUP BY tag.id, tag.key
  `) as DbRow[];
  return rows.length === 1 ? toAdminTag(rows[0]) : null;
}

async function hasTagConflict(
  sql: ReturnType<typeof neon>,
  input: CreateAdminTagInput | UpdateAdminTagInput,
  excludedId: string | null,
) {
  const key = "key" in input ? input.key : null;
  const rows = (await sql`
    SELECT tag.id
    FROM tags AS tag
    LEFT JOIN tag_translations AS translation ON translation.tag_id = tag.id
    WHERE (${key}::text IS NOT NULL AND tag.key = ${key})
      OR (translation.locale = 'ja' AND translation.name = ${input.nameJa})
      OR (${input.nameEn}::text IS NOT NULL AND translation.locale = 'en' AND translation.name = ${input.nameEn})
    GROUP BY tag.id
    HAVING ${excludedId}::uuid IS NULL OR tag.id <> ${excludedId}::uuid
    LIMIT 1
  `) as DbRow[];
  return rows.length > 0;
}

function getRequiredSql() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  return getSql();
}

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  sqlClient ??= neon(process.env.DATABASE_URL);
  return sqlClient;
}

function toAdminTag(row: DbRow): AdminTag {
  return {
    id: requiredUuid(row.id),
    key: requiredText(row.key),
    nameJa: requiredText(row.name_ja),
    nameEn: nullableText(row.name_en),
    pubCount: requiredNonNegativeInteger(row.pub_count),
  };
}

function requiredText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid admin tag text returned from database.");
  return value.trim();
}

function nullableText(value: unknown) {
  return value === null || value === undefined ? null : requiredText(value);
}

function requiredUuid(value: unknown) {
  const text = requiredText(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new Error("Invalid admin tag UUID returned from database.");
  }
  return text;
}

function requiredNonNegativeInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error("Invalid admin tag count returned from database.");
  return parsed;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
