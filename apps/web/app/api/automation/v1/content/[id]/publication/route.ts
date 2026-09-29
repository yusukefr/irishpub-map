import {
  AdminContentPublicationValidationError,
  isAdminContentId,
  parseSetAdminContentPublicationInput,
} from "@irishpub-map/shared/admin-content";
import { adminApiErrorResponse, getAdminJsonContentTypeError } from "../../../../../../lib/admin-api";
import { adminContentServiceErrorResponse } from "../../../../../../lib/admin-content-api";
import { isContentDatabaseConfigured } from "../../../../../../lib/admin-content-repository";
import { changeAdminContentPublication } from "../../../../../../lib/admin-content-service";
import { getAutomationApiAuthorizationError } from "../../../../../../lib/automation-auth";
import { handleAutomationMutation } from "../../../../../../lib/automation-reliability";

/**
 * content:publishを持つAutomation Clientが指定Contentを公開またはDraftへ変更します。
 * @param {Request} request - Bearer Tokenと変更後statusを含むリクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - Content IDを含むRoute Context。
 * @param {Promise<{ id: string }>} context.params - Content ID。
 * @returns {Promise<Response>} 公開状態変更結果またはエラー。
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleAutomationMutation(request, {
    scope: "content:publish",
    resourceType: "content",
    resourceId: isAdminContentId(id) ? id : null,
    execute: () => changePublication(request, context),
  });
}

async function changePublication(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorizationError = getAutomationApiAuthorizationError(request, "content:publish");
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
