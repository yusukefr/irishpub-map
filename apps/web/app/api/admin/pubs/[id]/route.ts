import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../../lib/admin-api";
import { deletePub, isDatabaseConfigured, PubInputValidationError, updatePub } from "../../../../lib/pub-repository";

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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  try {
    const pub = await updatePub((await context.params).id, body);
    return pub ? Response.json({ pub }) : adminApiErrorResponse("pub_not_found", 404);
  } catch (error) {
    return error instanceof PubInputValidationError
      ? adminApiErrorResponse("invalid_pub_data", 400)
      : adminApiErrorResponse("internal_error", 500);
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
  try {
    return (await deletePub((await context.params).id))
      ? Response.json({ ok: true })
      : adminApiErrorResponse("pub_not_found", 404);
  } catch {
    return adminApiErrorResponse("internal_error", 500);
  }
}
