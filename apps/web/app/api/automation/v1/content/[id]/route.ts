import { isAdminContentId } from "@irishpub-map/shared/admin-content";
import { adminApiErrorResponse, getAdminJsonContentTypeError } from "../../../../../lib/admin-api";
import { adminContentServiceErrorResponse } from "../../../../../lib/admin-content-api";
import { isContentDatabaseConfigured } from "../../../../../lib/admin-content-repository";
import { readAdminContent, updateAdminContent } from "../../../../../lib/admin-content-service";
import { getAutomationApiAuthorizationError } from "../../../../../lib/automation-auth";
import { handleAutomationMutation } from "../../../../../lib/automation-reliability";

/**
 * content:readを持つAutomation Clientへ指定Contentの管理詳細を返します。
 * @param {Request} request - Bearer Tokenを含むリクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - Content IDを含むRoute Context。
 * @param {Promise<{ id: string }>} context.params - Content ID。
 * @returns {Promise<Response>} Content詳細またはエラー。
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorizationError = getAutomationApiAuthorizationError(request, "content:read");
  if (authorizationError) return authorizationError;
  if (!isContentDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const { id } = await context.params;
  if (!isAdminContentId(id)) return adminApiErrorResponse("invalid_request", 400);
  try {
    return Response.json({ content: await readAdminContent(id) });
  } catch (error) {
    return adminContentServiceErrorResponse(error);
  }
}

/**
 * content:updateを持つAutomation Clientが公開状態を維持してContent全体を更新します。
 * @param {Request} request - Bearer TokenとContent全体のSnapshotを含むリクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - Content IDを含むRoute Context。
 * @param {Promise<{ id: string }>} context.params - Content ID。
 * @returns {Promise<Response>} 更新後詳細またはエラー。
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleAutomationMutation(request, {
    scope: "content:update",
    resourceType: "content",
    resourceId: isAdminContentId(id) ? id : null,
    execute: () => update(request, context),
  });
}

async function update(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorizationError = getAutomationApiAuthorizationError(request, "content:update");
  if (authorizationError) return authorizationError;
  if (!isContentDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  const { id } = await context.params;
  if (!isAdminContentId(id)) return adminApiErrorResponse("invalid_request", 400);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  try {
    return Response.json({ content: await updateAdminContent(id, body) });
  } catch (error) {
    return adminContentServiceErrorResponse(error);
  }
}
