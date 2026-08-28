import { adminApiErrorResponse, getAdminApiAuthorizationError } from "../../../lib/admin-api";
import { getAdminPubStatuses } from "../../../lib/status-repository";

/**
 * 認証済み管理者へ固定keyと日英表示名を含む営業ステータス一覧を返します。
 * @param {Request} request - 管理者セッションを含むリクエスト。
 * @returns {Promise<Response>} 管理用営業ステータス一覧とDB設定状態。
 */
export async function GET(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  try {
    return Response.json({
      statuses: await getAdminPubStatuses(),
      databaseConfigured: Boolean(process.env.DATABASE_URL),
    });
  } catch {
    return adminApiErrorResponse("internal_error", 500);
  }
}
