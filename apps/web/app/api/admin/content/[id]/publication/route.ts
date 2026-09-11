import {
  AdminContentPublicationValidationError,
  isAdminContentId,
  parseSetAdminContentPublicationInput,
} from "@irishpub-map/shared/admin-content";
import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../../../lib/admin-api";
import { adminContentServiceErrorResponse } from "../../../../../lib/admin-content-api";
import { isContentDatabaseConfigured } from "../../../../../lib/admin-content-repository";
import { changeAdminContentPublication } from "../../../../../lib/admin-content-service";

/**
 * 指定Contentを公開またはDraftへ変更します。
 * @param {Request} request - 変更後statusを含むリクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - Content IDを含むRoute Context。
 * @param {Promise<{ id: string }>} context.params - Content ID。
 * @returns {Promise<Response>} 公開状態変更結果またはエラー。
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
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
    const { status } = parseSetAdminContentPublicationInput(body);
    return Response.json({ publication: await changeAdminContentPublication(id, status) });
  } catch (error) {
    if (error instanceof AdminContentPublicationValidationError) {
      return adminApiErrorResponse("validation_error", 422);
    }
    return adminContentServiceErrorResponse(error);
  }
}
