import { adminMasterErrorResponse } from "../../../../../lib/admin-api";
import { getAutomationApiAuthorizationError } from "../../../../../lib/automation-auth";
import { getPubTypes } from "../../../../../lib/master-repository";

/** master:readを持つAutomation Clientへ店舗種別マスタを返します。
 * @param {Request} request - Bearer Tokenを含むリクエスト。
 * @returns {Promise<Response>} 店舗種別一覧、または認証・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAutomationApiAuthorizationError(request, "master:read");
  if (authorizationError) return authorizationError;
  try {
    return Response.json({ pubTypes: await getPubTypes() });
  } catch {
    return adminMasterErrorResponse();
  }
}
