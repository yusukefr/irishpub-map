import { isAdminContentId } from "@irishpub-map/shared/admin-content";
import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../../lib/admin-api";
import { adminContentServiceErrorResponse } from "../../../../lib/admin-content-api";
import { isContentDatabaseConfigured } from "../../../../lib/admin-content-repository";
import { readAdminContent, updateAdminContent } from "../../../../lib/admin-content-service";

/**
 * 指定IDのEditorial Content管理詳細を返します。
 * @param {Request} request - 管理者セッションを含むリクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - Content IDを含むRoute Context。
 * @param {Promise<{ id: string }>} context.params - Content ID。
 * @returns {Promise<Response>} Content詳細またはエラー。
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorizationError = getAdminApiAuthorizationError(request);
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
 * 指定IDのEditorial Contentを公開状態を維持して更新します。
 * @param {Request} request - Contentスナップショットを含むリクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - Content IDを含むRoute Context。
 * @param {Promise<{ id: string }>} context.params - Content ID。
 * @returns {Promise<Response>} 更新後詳細またはエラー。
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorizationError = getAdminApiAuthorizationError(request);
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
