import { randomUUID } from "node:crypto";
import {
  AdminPubWriteValidationError,
  parseAdminPubWriteInput,
  type AdminPub,
  type AdminPubFieldErrors,
  type AdminPubWriteInput,
} from "@irishpub-map/shared/admin-pub";
import {
  getAdminPub,
  insertAdminPub,
  removeAdminPub,
  replaceAdminPub,
  validateAdminPubReferences,
} from "./admin-pub-repository";

/** Application ServiceがAPIへ安全に公開できる店舗操作エラーです。 */
export class AdminPubServiceError extends Error {
  /**
   * 店舗操作の業務エラーを構造化情報とともに生成します。
   * @param {"validation" | "reference_conflict" | "not_found" | "publication_requirements_not_met"} code - エラー種別。
   * @param {AdminPubFieldErrors} fieldErrors - 入力または参照のフィールド別エラー。
   * @param {string[]} missingFields - 公開済み店舗の更新で不足する公開必須項目。
   */
  constructor(
    readonly code: "validation" | "reference_conflict" | "not_found" | "publication_requirements_not_met",
    readonly fieldErrors: AdminPubFieldErrors = {},
    readonly missingFields: string[] = [],
  ) {
    super("Admin pub service error: " + code);
    this.name = "AdminPubServiceError";
  }
}

/**
 * 未検証入力から必ず非公開の管理店舗を作成します。
 * @param {unknown} value - Route Handlerが受け取ったJSON本文。
 * @returns {Promise<AdminPub>} 作成後の管理店舗詳細。
 */
export async function createAdminPub(value: unknown): Promise<AdminPub> {
  const input = parseWriteInput(value);
  const references = await validateAdminPubReferences(input);
  throwReferenceErrors(references.fieldErrors);

  const id = randomUUID();
  await insertAdminPub(id, input, references.statusCode);
  const created = await getAdminPub(id);
  if (!created) throw new Error("Created admin pub could not be read.");
  return created;
}

/**
 * 管理店舗の詳細を取得し、存在しない場合は業務エラーに変換します。
 * @param {string} id - 対象店舗のUUID。
 * @returns {Promise<AdminPub>} 管理店舗詳細。
 */
export async function readAdminPub(id: string): Promise<AdminPub> {
  const pub = await getAdminPub(id);
  if (!pub) throw new AdminPubServiceError("not_found");
  return pub;
}

/**
 * 公開状態を変えずに店舗全体を更新し、公開済み店舗には更新後のPublish Validationを適用します。
 * @param {string} id - 更新対象店舗のUUID。
 * @param {unknown} value - Route Handlerが受け取ったJSON本文。
 * @returns {Promise<AdminPub>} 更新後の管理店舗詳細。
 */
export async function updateAdminPub(id: string, value: unknown): Promise<AdminPub> {
  const input = parseWriteInput(value);
  const references = await validateAdminPubReferences(input);
  throwReferenceErrors(references.fieldErrors);

  const missingFields = getPublicationMissingFields(input);
  const result = await replaceAdminPub(id, input, references.statusCode, missingFields.length === 0);
  if (result === "not_found") throw new AdminPubServiceError("not_found");
  if (result === "publication_blocked") {
    throw new AdminPubServiceError("publication_requirements_not_met", {}, missingFields);
  }

  const updated = await getAdminPub(id);
  if (!updated) throw new Error("Updated admin pub could not be read.");
  return updated;
}

/**
 * 管理店舗を削除します。
 * @param {string} id - 削除対象店舗のUUID。
 * @returns {Promise<void>} 削除できた場合に解決します。
 */
export async function deleteAdminPub(id: string): Promise<void> {
  if (!(await removeAdminPub(id))) throw new AdminPubServiceError("not_found");
}

/**
 * 店舗入力に対するPublish Validationを行い、不足項目コードを返します。
 * @param {AdminPubWriteInput} input - Draft Validation済みの店舗入力。
 * @returns {string[]} 公開必須だが不足している項目コード。
 */
export function getPublicationMissingFields(input: AdminPubWriteInput): string[] {
  const checks = [
    ["name", Boolean(input.translations.ja.name)],
    ["address", Boolean(input.translations.ja.address)],
    ["prefecture", input.prefectureCode !== null],
    ["municipality", input.municipalityCode !== null],
    ["latitude", input.latitude !== null],
    ["longitude", input.longitude !== null],
    ["status", input.status !== null],
  ] as const;
  return checks.filter(([, complete]) => !complete).map(([field]) => field);
}

function parseWriteInput(value: unknown) {
  try {
    return parseAdminPubWriteInput(value);
  } catch (error) {
    if (error instanceof AdminPubWriteValidationError) {
      throw new AdminPubServiceError("validation", error.fieldErrors);
    }
    throw error;
  }
}

function throwReferenceErrors(fieldErrors: AdminPubFieldErrors) {
  if (Object.keys(fieldErrors).length > 0) {
    throw new AdminPubServiceError("reference_conflict", fieldErrors);
  }
}
