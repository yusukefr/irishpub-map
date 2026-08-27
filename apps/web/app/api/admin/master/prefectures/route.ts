import { adminMasterErrorResponse, getAdminApiAuthorizationError } from "../../../../lib/admin-api";
import { getPrefectures } from "../../../../lib/master-repository";

/**
 * 認証済み管理者へ都道府県マスタを返します。
 * @param {Request} request - 管理者セッションを含むリクエスト。
 * @returns {Promise<Response>} 都道府県一覧、または認証・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  try {
    return Response.json({ prefectures: await getPrefectures() });
  } catch {
    return adminMasterErrorResponse();
  }
}
