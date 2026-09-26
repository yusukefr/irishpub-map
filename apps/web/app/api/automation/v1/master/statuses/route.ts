import { adminMasterErrorResponse } from "../../../../../lib/admin-api";
import { getAutomationApiAuthorizationError } from "../../../../../lib/automation-auth";
import { getPubStatuses } from "../../../../../lib/master-repository";

/**
 * master:readを持つAutomation Clientへ現行の営業ステータスマスタを返します。
 * @param {Request} request - Bearer Tokenを含むリクエスト。
 * @returns {Promise<Response>} 営業ステータス一覧、または認証・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAutomationApiAuthorizationError(request, "master:read");
  if (authorizationError) return authorizationError;
  try {
    return Response.json({ statuses: await getPubStatuses() });
  } catch {
    return adminMasterErrorResponse();
  }
}
