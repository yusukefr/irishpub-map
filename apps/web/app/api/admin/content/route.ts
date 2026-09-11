import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../lib/admin-api";
import { adminContentServiceErrorResponse } from "../../../lib/admin-content-api";
import { isContentDatabaseConfigured } from "../../../lib/admin-content-repository";
import { createAdminContent, readAdminContentList } from "../../../lib/admin-content-service";

/**
 * 認証済み管理者へDraftを含むEditorial Content一覧を返します。
 * @param {Request} request - 管理者セッションを含むリクエスト。
 * @returns {Promise<Response>} Content一覧とDB設定状態。
 */
export async function GET(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
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
 * 認証済み管理者がEditorial ContentをDraft作成します。
 * @param {Request} request - Contentスナップショットを含むリクエスト。
 * @returns {Promise<Response>} 作成後詳細、または入力・認証エラー。
 */
export async function POST(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
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
