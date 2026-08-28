import { adminMasterErrorResponse, getAdminApiAuthorizationError } from "../../../../lib/admin-api";
import { getMunicipalitiesByPrefecture } from "../../../../lib/master-repository";

/**
 * 認証済み管理者へ指定都道府県の市区町村マスタを返します。
 * @param {Request} request - 都道府県コードと管理者セッションを含むリクエスト。
 * @returns {Promise<Response>} 市区町村一覧、または入力・認証・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;

  const value = new URL(request.url).searchParams.get("prefectureCode");
  if (!value || !/^(?:[1-9]|[1-3][0-9]|4[0-7])$/.test(value)) {
    return Response.json({ error: "Invalid prefectureCode." }, { status: 400 });
  }

  try {
    return Response.json({ municipalities: await getMunicipalitiesByPrefecture(Number(value)) });
  } catch {
    return adminMasterErrorResponse();
  }
}
