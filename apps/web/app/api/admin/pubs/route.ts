import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../lib/admin-api";
import { createPub, getAdminPubs, isDatabaseConfigured, PubInputValidationError } from "../../../lib/pub-repository";

/**
 * 認証済み管理者へ店舗一覧とDB設定状態を返します。
 * @param {Request} request - 管理者セッションを含むリクエスト。
 * @returns {Promise<Response>} 店舗一覧とDB設定状態。
 */
export async function GET(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  try {
    return Response.json({ pubs: await getAdminPubs(), databaseConfigured: isDatabaseConfigured() });
  } catch {
    return adminApiErrorResponse("internal_error", 500);
  }
}

/**
 * 認証済みかつDB設定済みの場合に店舗を新規登録します。
 * @param {Request} request - 登録する店舗データを含むリクエスト。
 * @returns {Promise<Response>} 登録結果、または入力・認証エラー。
 */
export async function POST(request: Request) {
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
    return Response.json({ pub: await createPub(body) }, { status: 201 });
  } catch (error) {
    return error instanceof PubInputValidationError
      ? adminApiErrorResponse("invalid_pub_data", 400)
      : adminApiErrorResponse("internal_error", 500);
  }
}
