import { adminMasterErrorResponse, getAdminApiAuthorizationError } from "../../../../lib/admin-api";
import { getPubStatuses } from "../../../../lib/master-repository";

/**
 * 認証済み管理者へ営業ステータスマスタを返します。
 * @param {Request} request - 管理者セッションを含むリクエスト。
 * @returns {Promise<Response>} 営業ステータス一覧、または認証・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  try {
    return Response.json({ statuses: await getPubStatuses() });
  } catch {
    return adminMasterErrorResponse();
  }
}
