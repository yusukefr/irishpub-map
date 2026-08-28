import { AdminTagValidationError } from "@irishpub-map/shared/admin-tag";
import { adminApiErrorResponse } from "./admin-api";
import { TagRepositoryError } from "./tag-repository";

/**
 * 管理タグのValidation・競合・存在・使用中エラーを内部情報なしのHTTPレスポンスへ変換します。
 * @param {unknown} error - 共有ValidationまたはRepositoryから送出されたエラー。
 * @returns {Response} 利用者が対処可能なエラー、または一般化した500レスポンス。
 */
export function adminTagErrorResponse(error: unknown) {
  if (error instanceof AdminTagValidationError) {
    return adminApiErrorResponse("validation_error", 422, error.fieldErrors);
  }
  if (error instanceof TagRepositoryError) {
    if (error.code === "not_found") return adminApiErrorResponse("tag_not_found", 404);
    if (error.code === "in_use") return adminApiErrorResponse("tag_in_use", 409);
    return adminApiErrorResponse("tag_conflict", 409);
  }
  return adminApiErrorResponse("internal_error", 500);
}

/**
 * Route ParameterがPostgresへ渡せるUUIDかを判定します。
 * @param {string} value - 判定するタグID。
 * @returns {boolean} UUID形式の場合はtrue。
 */
export function isAdminTagId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
