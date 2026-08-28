import { AdminStatusValidationError } from "@irishpub-map/shared/admin-status";
import { adminApiErrorResponse } from "./admin-api";
import { StatusRepositoryError } from "./status-repository";

/**
 * 営業ステータスのValidation・存在エラーを内部情報なしのHTTPレスポンスへ変換します。
 * @param {unknown} error - 共有ValidationまたはRepositoryから送出されたエラー。
 * @returns {Response} 利用者が対処可能なエラー、または一般化した500レスポンス。
 */
export function adminStatusErrorResponse(error: unknown) {
  if (error instanceof AdminStatusValidationError) {
    return adminApiErrorResponse("validation_error", 422, error.fieldErrors);
  }
  if (error instanceof StatusRepositoryError) return adminApiErrorResponse("status_not_found", 404);
  return adminApiErrorResponse("internal_error", 500);
}

/**
 * Route ParameterをPostgresの正のSMALLINTへ安全に変換します。
 * @param {string} value - 判定・変換する営業ステータスコード。
 * @returns {number | null} 正しい10進整数の場合は数値、それ以外はnull。
 */
export function parseAdminStatusCode(value: string) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const code = Number(value);
  return Number.isSafeInteger(code) && code <= 32767 ? code : null;
}
