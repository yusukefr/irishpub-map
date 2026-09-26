import { adminApiErrorResponse, getAdminJsonContentTypeError } from "../../../../lib/admin-api";
import { adminContentServiceErrorResponse } from "../../../../lib/admin-content-api";
import { isContentDatabaseConfigured } from "../../../../lib/admin-content-repository";
import { createAdminContent, readAdminContentList } from "../../../../lib/admin-content-service";
import { getAutomationApiAuthorizationError } from "../../../../lib/automation-auth";

/**
 * content:readを持つAutomation ClientへDraftとPublishedの管理一覧を返します。
 * @param {Request} request - Bearer Tokenを含むリクエスト。
 * @returns {Promise<Response>} Content一覧とDB設定状態、または認証・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAutomationApiAuthorizationError(request, "content:read");
  if (authorizationError) return authorizationError;
  try {
    return Response.json({
      content: await readAdminContentList(),
      databaseConfigured: isContentDatabaseConfigured(),
    });
  } catch {
    return adminApiErrorResponse("internal_error", 500);
  }
}

/**
 * content:createを持つAutomation Clientの入力を既存Serviceで検証し、Draftを作成します。
 * @param {Request} request - Bearer TokenとContent全体のSnapshotを含むリクエスト。
 * @returns {Promise<Response>} 作成後詳細、または認証・入力・保存エラー。
 */
export async function POST(request: Request) {
  const authorizationError = getAutomationApiAuthorizationError(request, "content:create");
  if (authorizationError) return authorizationError;
  if (!isContentDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  try {
    return Response.json({ content: await createAdminContent(body) }, { status: 201 });
  } catch (error) {
    return adminContentServiceErrorResponse(error);
  }
}
