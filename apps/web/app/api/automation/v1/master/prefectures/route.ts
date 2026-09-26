import { getAutomationApiAuthorizationError } from "../../../../../lib/automation-auth";
import { adminMasterErrorResponse } from "../../../../../lib/admin-api";
import { getPrefectures } from "../../../../../lib/master-repository";

/**
 * master:readを持つAutomation Clientへ現行の都道府県マスタを返します。
 * @param {Request} request - Bearer Tokenを含むリクエスト。
 * @returns {Promise<Response>} 都道府県一覧、または認証・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAutomationApiAuthorizationError(request, "master:read");
  if (authorizationError) return authorizationError;
  try {
    return Response.json({ prefectures: await getPrefectures() });
  } catch {
    return adminMasterErrorResponse();
  }
}
