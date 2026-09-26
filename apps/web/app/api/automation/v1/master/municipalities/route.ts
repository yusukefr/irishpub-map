import { adminApiErrorResponse, adminMasterErrorResponse } from "../../../../../lib/admin-api";
import { getAutomationApiAuthorizationError } from "../../../../../lib/automation-auth";
import { resolveRequestLocale } from "../../../../../lib/i18n";
import { getMunicipalitiesByPrefecture } from "../../../../../lib/master-repository";
import { parseMasterPrefectureCode } from "../../../../../lib/prefecture-code";

/**
 * master:readを持つAutomation Clientへ指定都道府県の市区町村を返します。
 * @param {Request} request - Bearer Tokenと都道府県コードを含むリクエスト。
 * @returns {Promise<Response>} 市区町村一覧、または認証・入力・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAutomationApiAuthorizationError(request, "master:read");
  if (authorizationError) return authorizationError;

  const prefectureCode = parseMasterPrefectureCode(new URL(request.url).searchParams.get("prefectureCode"));
  if (prefectureCode === null) return adminApiErrorResponse("invalid_prefecture_code", 400);

  try {
    return Response.json({
      municipalities: await getMunicipalitiesByPrefecture(prefectureCode, resolveRequestLocale(request)),
    });
  } catch {
    return adminMasterErrorResponse();
  }
}
