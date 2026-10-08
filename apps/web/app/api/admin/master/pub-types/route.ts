import { adminMasterErrorResponse, getAdminApiAuthorizationError } from "../../../../lib/admin-api";
import { getPubTypes } from "../../../../lib/master-repository";

/** 認証済み管理者へ店舗種別マスタを返します。
 * @param {Request} request - 管理者セッションを含むリクエスト。
 * @returns {Promise<Response>} 店舗種別一覧、または認証・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  try {
    return Response.json({ pubTypes: await getPubTypes() });
  } catch {
    return adminMasterErrorResponse();
  }
}
