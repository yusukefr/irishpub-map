import { getAdminSession, isAdminConfigured } from "./admin-auth";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * 状態を変更する管理APIで、リクエスト先と完全一致するOriginを要求します。
 * @param {Request} request - Originを検証する管理APIリクエスト。
 * @returns {Response | null} Origin欠落・不一致時の403レスポンス。検証対象外または一致時はnull。
 */
export function getAdminMutationOriginError(request: Request) {
  if (!MUTATION_METHODS.has(request.method)) return null;
  return request.headers.get("origin") === new URL(request.url).origin
    ? null
    : Response.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * 管理APIリクエストの署名済みセッションと、変更系リクエストのOriginを検証します。
 * @param {Request} request - Cookieと、変更系の場合はOriginを含む管理APIリクエスト。
 * @returns {Response | null} 認証・Origin検証のエラーレスポンス。検証成功時はnull。
 */
export function getAdminApiAuthorizationError(request: Request) {
  if (!isAdminConfigured() || !getAdminSession(request.headers.get("cookie"))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return getAdminMutationOriginError(request);
}

/**
 * DB内部情報を公開しない管理マスタ取得エラーを返します。
 * @returns {Response} 一般化した500レスポンス。
 */
export function adminMasterErrorResponse() {
  return Response.json({ error: "Could not load master data." }, { status: 500 });
}
