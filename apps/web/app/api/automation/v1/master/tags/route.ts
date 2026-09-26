import { adminMasterErrorResponse } from "../../../../../lib/admin-api";
import { getAutomationApiAuthorizationError } from "../../../../../lib/automation-auth";
import { getAdminTags } from "../../../../../lib/tag-repository";

/**
 * master:readを持つAutomation Clientへ翻訳と使用店舗数を含むタグ一覧を返します。
 * @param {Request} request - Bearer Tokenを含むリクエスト。
 * @returns {Promise<Response>} タグ一覧、または認証・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAutomationApiAuthorizationError(request, "master:read");
  if (authorizationError) return authorizationError;
  try {
    return Response.json({ tags: await getAdminTags() });
  } catch {
    return adminMasterErrorResponse();
  }
}
