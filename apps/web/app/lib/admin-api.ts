import { getAdminSession, isAdminConfigured } from "./admin-auth";

/**
 * 管理APIリクエストの署名済みセッションを検証します。
 * @param {Request} request - Cookieを含む管理APIリクエスト。
 * @returns {Response | null} 未認証時の一般化した401レスポンス。認証済みの場合はnull。
 */
export function getAdminApiAuthorizationError(request: Request) {
  return isAdminConfigured() && getAdminSession(request.headers.get("cookie"))
    ? null
    : Response.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * DB内部情報を公開しない管理マスタ取得エラーを返します。
 * @returns {Response} 一般化した500レスポンス。
 */
export function adminMasterErrorResponse() {
  return Response.json({ error: "Could not load master data." }, { status: 500 });
}
