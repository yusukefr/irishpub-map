import { AdminPubSearchValidationError, parseAdminPubSearchParams } from "@irishpub-map/shared/admin-pub";
import { adminApiErrorResponse, getAdminJsonContentTypeError } from "../../../../lib/admin-api";
import { adminPubServiceErrorResponse } from "../../../../lib/admin-pub-api";
import { getAdminPub } from "../../../../lib/admin-pub-repository";
import { createAdminPub } from "../../../../lib/admin-pub-service";
import { getAutomationApiAuthorizationError } from "../../../../lib/automation-auth";
import { handleAutomationCreate } from "../../../../lib/automation-reliability";
import { resolveRequestLocale } from "../../../../lib/i18n";
import { getAdminPubPage, isDatabaseConfigured } from "../../../../lib/pub-repository";

/**
 * pubs:readを持つAutomation Clientへ管理店舗の検索結果を返します。
 * @param {Request} request - Bearer Tokenと検索条件を含むリクエスト。
 * @returns {Promise<Response>} 管理店舗のページとDB設定状態、またはエラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAutomationApiAuthorizationError(request, "pubs:read");
  if (authorizationError) return authorizationError;
  try {
    const page = await getAdminPubPage(
      parseAdminPubSearchParams(new URL(request.url).searchParams),
      resolveRequestLocale(request),
    );
    return Response.json({ ...page, databaseConfigured: isDatabaseConfigured() });
  } catch (error) {
    if (error instanceof AdminPubSearchValidationError) return adminApiErrorResponse("invalid_request", 400);
    return adminApiErrorResponse("internal_error", 500);
  }
}

/**
 * pubs:createを持つAutomation Clientの入力を既存Serviceで検証し、非公開店舗を作成します。
 * @param {Request} request - Bearer Tokenと管理店舗の全体Snapshotを含むリクエスト。
 * @returns {Promise<Response>} 作成後詳細、または認証・入力・保存エラー。
 */
export async function POST(request: Request) {
  return handleAutomationCreate(request, {
    scope: "pubs:create",
    resourceType: "pub",
    execute: (id) => create(request, id),
    recover: (id) => getAdminPub(id),
  });
}

async function create(request: Request, id: string) {
  const authorizationError = getAutomationApiAuthorizationError(request, "pubs:create");
  if (authorizationError) return authorizationError;
  if (!isDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  try {
    return Response.json({ pub: await createAdminPub(body, id) }, { status: 201 });
  } catch (error) {
    return adminPubServiceErrorResponse(error);
  }
}
