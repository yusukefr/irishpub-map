import { isPubId } from "@irishpub-map/shared/pub";
import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../../lib/admin-api";
import { AdminPubServiceError, deleteAdminPub, readAdminPub, updateAdminPub } from "../../../../lib/admin-pub-service";
import { isDatabaseConfigured } from "../../../../lib/pub-repository";

/**
 * 指定IDの管理店舗詳細を返します。
 * @param {Request} request - 管理者セッションを含むリクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - ルートパラメータ。
 * @param {Promise<{ id: string }>} context.params - 店舗IDを含むパラメータ。
 * @returns {Promise<Response>} 管理店舗詳細、または認証・存在確認エラー。
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!isDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const { id } = await context.params;
  if (!isPubId(id)) return adminApiErrorResponse("invalid_request", 400);

  try {
    return Response.json({ pub: await readAdminPub(id) });
  } catch (error) {
    return adminPubServiceErrorResponse(error);
  }
}

/**
 * 指定IDの店舗を検証済み入力で更新します。
 * @param {Request} request - 更新対象の店舗データを含むリクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - ルートパラメータ。
 * @param {Promise<{ id: string }>} context.params - 店舗IDを含むパラメータ。
 * @returns {Promise<Response>} 更新結果、または入力・認証エラー。
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
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
    return Response.json({ pub: await updateAdminPub(id, body) });
  } catch (error) {
    return adminPubServiceErrorResponse(error);
  }
}

/**
 * 指定IDの店舗を削除し、存在しない場合は404を返します。
 * @param {Request} request - 削除リクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - ルートパラメータ。
 * @param {Promise<{ id: string }>} context.params - 店舗IDを含むパラメータ。
 * @returns {Promise<Response>} 削除結果、または認証・存在確認エラー。
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!isDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const { id } = await context.params;
  if (!isPubId(id)) return adminApiErrorResponse("invalid_request", 400);
  try {
    await deleteAdminPub(id);
    return Response.json({ ok: true });
  } catch (error) {
    return adminPubServiceErrorResponse(error);
  }
}

function adminPubServiceErrorResponse(error: unknown) {
  if (!(error instanceof AdminPubServiceError)) return adminApiErrorResponse("internal_error", 500);
  if (error.code === "not_found") return adminApiErrorResponse("pub_not_found", 404);
  if (error.code === "validation") return adminApiErrorResponse("validation_error", 422, error.fieldErrors);
  if (error.code === "reference_conflict") {
    return adminApiErrorResponse("validation_error", 409, error.fieldErrors);
  }
  return Response.json(
    { errorCode: "publication_requirements_not_met", missingFields: error.missingFields },
    { status: 422 },
  );
}
