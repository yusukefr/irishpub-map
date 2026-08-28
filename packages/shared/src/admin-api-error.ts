/** 管理APIが返せる、表示言語に依存しないエラーコード一覧です。 */
export const ADMIN_API_ERROR_CODES = [
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
  "invalid_status_code",
  "status_not_found",
] as const;

/** 管理APIが返す、表示言語に依存しないエラーコードです。 */
export type AdminApiErrorCode = (typeof ADMIN_API_ERROR_CODES)[number];

/** フィールドValidationで返せる、表示言語に依存しない理由コード一覧です。 */
export const ADMIN_FIELD_ERROR_CODES = [
  "required",
  "too_long",
  "invalid_format",
  "invalid_type",
  "leading_or_trailing_space",
  "immutable",
] as const;

/** フィールドValidationの理由を表す、表示言語に依存しないコードです。 */
export type AdminFieldErrorCode = (typeof ADMIN_FIELD_ERROR_CODES)[number];

/** 管理APIの失敗レスポンス契約です。 */
export type AdminApiErrorResponse = {
  errorCode: AdminApiErrorCode;
  fieldErrors?: Record<string, AdminFieldErrorCode>;
};

const adminApiErrorCodeSet = new Set<string>(ADMIN_API_ERROR_CODES);
const adminFieldErrorCodeSet = new Set<string>(ADMIN_FIELD_ERROR_CODES);

/**
 * 未検証値が既知の管理APIエラーコードかを判定します。
 * @param {unknown} value - APIレスポンスなどから取得した未検証値。
 * @returns {value is AdminApiErrorCode} 既知コードの場合はtrue。
 */
export function isAdminApiErrorCode(value: unknown): value is AdminApiErrorCode {
  return typeof value === "string" && adminApiErrorCodeSet.has(value);
}

/**
 * 未検証値が既知のフィールドValidation理由コードかを判定します。
 * @param {unknown} value - APIレスポンスなどから取得した未検証値。
 * @returns {value is AdminFieldErrorCode} 既知コードの場合はtrue。
 */
export function isAdminFieldErrorCode(value: unknown): value is AdminFieldErrorCode {
  return typeof value === "string" && adminFieldErrorCodeSet.has(value);
}
