import { AdminPubPublicationValidationError, parseSetAdminPubPublicationInput } from "@irishpub-map/shared/admin-pub";
import { isPubId } from "@irishpub-map/shared/pub";
import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../../../lib/admin-api";
import {
  isDatabaseConfigured,
  PubPublicationValidationError,
  setAdminPubPublication,
} from "../../../../../lib/pub-repository";

/**
 * 認証済み管理者が店舗の公開状態だけを変更し、公開時には必須条件を検証します。
 * @param {Request} request - 公開状態と管理者セッションを含むリクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - 店舗IDを含むルートパラメータ。
 * @param {Promise<{ id: string }>} context.params - 店舗IDを含むパラメータ。
 * @returns {Promise<Response>} 公開状態変更結果、または認証・入力・公開条件エラー。
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorizationError = getAdminApiAuthorizationError(request);
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
