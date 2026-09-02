import { neon } from "@neondatabase/serverless";
import type { AdminPubStatus, UpdateAdminPubStatusInput } from "@irishpub-map/shared/admin-status";
import { getE2EAdminPubStatuses } from "./e2e-test-fixtures";
import { isE2ETestMode, rejectE2ETestMutation } from "./e2e-test-mode";

type DbRow = Record<string, unknown>;
let sqlClient: ReturnType<typeof neon> | null = null;

/** 営業ステータス管理で安全にHTTPエラーへ変換できる業務エラーです。 */
export class StatusRepositoryError extends Error {
  /**
   * Repository業務エラーを生成します。
   * @param {"not_found"} code - APIで404へ変換するエラー種別。
   */
  constructor(readonly code: "not_found") {
    super("Admin status repository error: not_found");
    this.name = "StatusRepositoryError";
  }
}

/**
 * 固定keyと日英表示名を含む管理用営業ステータス一覧をコード順で取得します。
 * @returns {Promise<AdminPubStatus[]>} DB未設定時は空配列、それ以外は検証済みDTO一覧。
 */
export async function getAdminPubStatuses(): Promise<AdminPubStatus[]> {
  if (isE2ETestMode()) return getE2EAdminPubStatuses();
  if (!process.env.DATABASE_URL) return [];
  const rows = (await getSql()`
    SELECT status.code, status.key,
      MAX(translation.display_name) FILTER (WHERE translation.locale = 'ja') AS name_ja,
      MAX(translation.display_name) FILTER (WHERE translation.locale = 'en') AS name_en
    FROM pub_statuses AS status
    LEFT JOIN pub_status_translations AS translation
      ON translation.status_code = status.code AND translation.locale IN ('ja', 'en')
    GROUP BY status.code, status.key
    ORDER BY status.code
  `) as DbRow[];
  return rows.map(toAdminPubStatus);
}

/**
 * 固定keyを維持し、日英表示名を1transactionで更新します。空の英語翻訳は削除します。
 * @param {number} code - 更新対象の営業ステータスコード。
 * @param {UpdateAdminPubStatusInput} input - 共有Validationを通過した日英表示名。
 * @returns {Promise<AdminPubStatus>} 更新後の管理用営業ステータス。
 */
export async function updateAdminPubStatus(code: number, input: UpdateAdminPubStatusInput): Promise<AdminPubStatus> {
  rejectE2ETestMutation();
  const sql = getRequiredSql();
  const current = await getAdminPubStatusByCode(sql, code);
  if (!current) throw new StatusRepositoryError("not_found");
  await sql.transaction((transaction) => {
    const queries = [
      transaction`
        INSERT INTO pub_status_translations (status_code, locale, display_name)
        VALUES (${code}, 'ja', ${input.nameJa})
        ON CONFLICT (status_code, locale) DO UPDATE SET display_name = EXCLUDED.display_name
      `,
    ];
    queries.push(
      input.nameEn
        ? transaction`
            INSERT INTO pub_status_translations (status_code, locale, display_name)
            VALUES (${code}, 'en', ${input.nameEn})
            ON CONFLICT (status_code, locale) DO UPDATE SET display_name = EXCLUDED.display_name
          `
        : transaction`
            DELETE FROM pub_status_translations WHERE status_code = ${code} AND locale = 'en'
          `,
    );
    return queries;
  });
  return { ...current, nameJa: input.nameJa, nameEn: input.nameEn };
}

async function getAdminPubStatusByCode(sql: ReturnType<typeof neon>, code: number) {
  const rows = (await sql`
    SELECT status.code, status.key,
      MAX(translation.display_name) FILTER (WHERE translation.locale = 'ja') AS name_ja,
      MAX(translation.display_name) FILTER (WHERE translation.locale = 'en') AS name_en
    FROM pub_statuses AS status
    LEFT JOIN pub_status_translations AS translation
      ON translation.status_code = status.code AND translation.locale IN ('ja', 'en')
    WHERE status.code = ${code}
    GROUP BY status.code, status.key
  `) as DbRow[];
  return rows.length === 1 ? toAdminPubStatus(rows[0]) : null;
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

function toAdminPubStatus(row: DbRow): AdminPubStatus {
  return {
    code: requiredPositiveInteger(row.code),
    key: requiredText(row.key),
    nameJa: requiredText(row.name_ja),
    nameEn: nullableText(row.name_en),
  };
}

function requiredPositiveInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error("Invalid admin status code returned from database.");
  return parsed;
}

function requiredText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid admin status text returned from database.");
  return value.trim();
}

function nullableText(value: unknown) {
  return value === null || value === undefined ? null : requiredText(value);
}
