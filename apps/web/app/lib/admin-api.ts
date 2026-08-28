import type { AdminApiErrorCode, AdminFieldErrorCode } from "@irishpub-map/shared/admin-api-error";
import { getAdminSession, isAdminConfigured } from "./admin-auth";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * 状態を変更する管理APIで、リクエスト先と完全一致するOriginを要求します。
 * @param {Request} request - Originを検証する管理APIリクエスト。
 * @returns {Response | null} Origin欠落・不一致時の403レスポンス。検証対象外または一致時はnull。
 */
export function getAdminMutationOriginError(request: Request) {
  if (!MUTATION_METHODS.has(request.method)) return null;
  return request.headers.get("origin") === new URL(request.url).origin ? null : adminApiErrorResponse("forbidden", 403);
}

/**
 * 管理APIリクエストの署名済みセッションと、変更系リクエストのOriginを検証します。
 * @param {Request} request - Cookieと、変更系の場合はOriginを含む管理APIリクエスト。
 * @returns {Response | null} 認証・Origin検証のエラーレスポンス。検証成功時はnull。
 */
export function getAdminApiAuthorizationError(request: Request) {
  if (!isAdminConfigured() || !getAdminSession(request.headers.get("cookie"))) {
    return adminApiErrorResponse("unauthorized", 401);
  }
  return getAdminMutationOriginError(request);
}

/**
 * JSON本文を受け付ける管理APIのContent-Typeを検証します。
 * @param {Request} request - JSON本文を持つ管理APIリクエスト。
 * @returns {Response | null} JSON以外の場合は415、検証成功時はnull。
 */
export function getAdminJsonContentTypeError(request: Request) {
  return request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() === "application/json"
    ? null
    : adminApiErrorResponse("invalid_content_type", 415);
}

/**
 * 管理APIの機械可読なエラー契約を生成します。
 * @param {AdminApiErrorCode} errorCode - Clientが翻訳へ変換する安定したエラーコード。
 * @param {number} status - エラー理由に対応するHTTP Status。
 * @param {Record<string, AdminFieldErrorCode>} [fieldErrors] - Validation時のフィールド別理由。
 * @returns {Response} UI文言や内部例外を含まないJSONレスポンス。
 */
export function adminApiErrorResponse(
  errorCode: AdminApiErrorCode,
  status: number,
  fieldErrors?: Partial<Record<string, AdminFieldErrorCode>>,
) {
  return Response.json({ errorCode, ...(fieldErrors ? { fieldErrors } : {}) }, { status });
}

/**
 * DB内部情報を公開しない管理マスタ取得エラーを返します。
 * @returns {Response} 一般化した500レスポンス。
 */
export function adminMasterErrorResponse() {
  return adminApiErrorResponse("internal_error", 500);
}
