import { AdminPubPublicationValidationError, parseSetAdminPubPublicationInput } from "@irishpub-map/shared/admin-pub";
import { isPubId } from "@irishpub-map/shared/pub";
import { adminApiErrorResponse, getAdminJsonContentTypeError } from "../../../../../../lib/admin-api";
import { getAutomationApiAuthorizationError } from "../../../../../../lib/automation-auth";
import {
  isDatabaseConfigured,
  PubPublicationValidationError,
  setAdminPubPublication,
} from "../../../../../../lib/pub-repository";

/**
 * pubs:publishを持つAutomation Clientが店舗の公開状態だけを変更します。
 * @param {Request} request - Bearer Tokenと変更後の公開状態を含むリクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - 店舗IDを含むRoute Context。
 * @param {Promise<{ id: string }>} context.params - 店舗ID。
 * @returns {Promise<Response>} 公開状態変更結果、または認証・入力・公開条件エラー。
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorizationError = getAutomationApiAuthorizationError(request, "pubs:publish");
  if (authorizationError) return authorizationError;
  if (!isDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  const { id } = await context.params;
  if (!isPubId(id)) return adminApiErrorResponse("invalid_request", 400);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  try {
    const input = parseSetAdminPubPublicationInput(body);
    const publication = await setAdminPubPublication(id, input.isPublished);
    return publication ? Response.json({ publication }) : adminApiErrorResponse("pub_not_found", 404);
  } catch (error) {
    if (error instanceof AdminPubPublicationValidationError) {
      return adminApiErrorResponse("validation_error", 422);
    }
    if (error instanceof PubPublicationValidationError) {
      return Response.json(
        { errorCode: "publication_requirements_not_met", missingFields: error.missingFields },
        { status: 422 },
      );
    }
    return adminApiErrorResponse("internal_error", 500);
  }
}
