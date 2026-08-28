/** 管理APIが返す、表示言語に依存しないエラーコードです。 */
export type AdminApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "invalid_request"
  | "invalid_json"
  | "invalid_content_type"
  | "validation_error"
  | "not_found"
  | "database_unavailable"
  | "internal_error"
  | "invalid_credentials"
  | "auth_not_configured"
  | "invalid_prefecture_code"
  | "invalid_pub_data"
  | "pub_not_found"
  | "tag_conflict"
  | "tag_not_found"
  | "tag_in_use"
  | "invalid_tag_id";

/** フィールドValidationの理由を表す、表示言語に依存しないコードです。 */
export type AdminFieldErrorCode =
  "required" | "too_long" | "invalid_format" | "invalid_type" | "leading_or_trailing_space" | "immutable";

/** 管理APIの失敗レスポンス契約です。 */
export type AdminApiErrorResponse = {
  errorCode: AdminApiErrorCode;
  fieldErrors?: Record<string, AdminFieldErrorCode>;
};

const ADMIN_API_ERROR_CODES = new Set<AdminApiErrorCode>([
  "unauthorized",
  "forbidden",
  "invalid_request",
  "invalid_json",
  "invalid_content_type",
  "validation_error",
  "not_found",
  "database_unavailable",
  "internal_error",
  "invalid_credentials",
  "auth_not_configured",
  "invalid_prefecture_code",
  "invalid_pub_data",
  "pub_not_found",
  "tag_conflict",
  "tag_not_found",
  "tag_in_use",
  "invalid_tag_id",
]);

/**
 * 未検証値が既知の管理APIエラーコードかを判定します。
 * @param {unknown} value - APIレスポンスなどから取得した未検証値。
 * @returns {value is AdminApiErrorCode} 既知コードの場合はtrue。
 */
export function isAdminApiErrorCode(value: unknown): value is AdminApiErrorCode {
  return typeof value === "string" && ADMIN_API_ERROR_CODES.has(value as AdminApiErrorCode);
}
