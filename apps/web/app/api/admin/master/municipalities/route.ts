import {
  adminApiErrorResponse,
  adminMasterErrorResponse,
  getAdminApiAuthorizationError,
} from "../../../../lib/admin-api";
import { resolveRequestLocale } from "../../../../lib/i18n";
import { getMunicipalitiesByPrefecture } from "../../../../lib/master-repository";
import { parseMasterPrefectureCode } from "../../../../lib/prefecture-code";

/**
 * 認証済み管理者へ指定都道府県の市区町村マスタを返します。
 * @param {Request} request - 都道府県コードと管理者セッションを含むリクエスト。
 * @returns {Promise<Response>} 市区町村一覧、または入力・認証・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;

  const prefectureCode = parseMasterPrefectureCode(new URL(request.url).searchParams.get("prefectureCode"));
  if (prefectureCode === null) {
    return adminApiErrorResponse("invalid_prefecture_code", 400);
  }

  try {
    return Response.json({
      municipalities: await getMunicipalitiesByPrefecture(prefectureCode, resolveRequestLocale(request)),
    });
  } catch {
    return adminMasterErrorResponse();
  }
}
