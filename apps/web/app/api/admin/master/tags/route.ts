import { adminMasterErrorResponse, getAdminApiAuthorizationError } from "../../../../lib/admin-api";
import { getTags } from "../../../../lib/master-repository";

/**
 * 認証済み管理者へタグマスタを返します。
 * @param {Request} request - 管理者セッションを含むリクエスト。
 * @returns {Promise<Response>} タグ一覧、または認証・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  try {
    return Response.json({ tags: await getTags() });
  } catch {
    return adminMasterErrorResponse();
  }
}
