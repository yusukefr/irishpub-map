import type { AdminFieldErrorCode } from "./admin-api-error";

/** 営業ステータス表示名として受け付ける最大文字数です。 */
export const ADMIN_STATUS_NAME_MAX_LENGTH = 100;

/** 管理画面で固定keyと日英表示名を扱う営業ステータスです。 */
export type AdminPubStatus = {
  code: number;
  key: string;
  nameJa: string;
  nameEn: string | null;
};

/** 営業ステータス表示名更新で検証済みとなる入力です。 */
export type UpdateAdminPubStatusInput = {
  nameJa: string;
  nameEn: string | null;
};

/** 営業ステータス表示名のフィールド別Validationエラーです。 */
export type AdminStatusFieldErrors = Partial<Record<keyof UpdateAdminPubStatusInput, AdminFieldErrorCode>>;

/** 営業ステータス表示名が更新契約を満たさない場合にフィールド別エラーを保持します。 */
export class AdminStatusValidationError extends Error {
  /**
   * フィールド別Validationエラーを保持して生成します。
   * @param {AdminStatusFieldErrors} fieldErrors - Clientへ返せるフィールド別エラー。
   */
  constructor(readonly fieldErrors: AdminStatusFieldErrors) {
    super("Invalid admin status input.");
    this.name = "AdminStatusValidationError";
  }
}

/**
 * 外部入力を、既存営業ステータスの表示名更新として保存可能な値へ変換します。
 * 本文にkeyが含まれても更新DTOへ含めず、システム識別子の変更には利用しません。
 * @param {unknown} value - APIなどから受け取った未検証の入力。
 * @returns {UpdateAdminPubStatusInput} 前後空白を処理した検証済み日英表示名。
 */
export function parseUpdateAdminPubStatusInput(value: unknown): UpdateAdminPubStatusInput {
  const input = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  const fieldErrors: AdminStatusFieldErrors = {};
  const nameJa = validateRequiredName(input?.nameJa, "nameJa", fieldErrors);
  const nameEn = validateOptionalName(input?.nameEn, fieldErrors);
  if (Object.keys(fieldErrors).length > 0) throw new AdminStatusValidationError(fieldErrors);
  return { nameJa: nameJa!, nameEn };
}

function validateRequiredName(value: unknown, field: "nameJa", fieldErrors: AdminStatusFieldErrors) {
  if (typeof value !== "string" || !value.trim()) {
    fieldErrors[field] = "required";
    return null;
  }
  const normalized = value.trim();
  if (normalized.length > ADMIN_STATUS_NAME_MAX_LENGTH) fieldErrors[field] = "too_long";
  return normalized;
}

function validateOptionalName(value: unknown, fieldErrors: AdminStatusFieldErrors) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    fieldErrors.nameEn = "invalid_type";
    return null;
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > ADMIN_STATUS_NAME_MAX_LENGTH) fieldErrors.nameEn = "too_long";
  return normalized;
}
