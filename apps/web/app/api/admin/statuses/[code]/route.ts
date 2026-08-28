import { parseUpdateAdminPubStatusInput } from "@irishpub-map/shared/admin-status";
import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../../lib/admin-api";
import { adminStatusErrorResponse, parseAdminStatusCode } from "../../../../lib/admin-status-api";
import { updateAdminPubStatus } from "../../../../lib/status-repository";

type RouteContext = { params: Promise<{ code: string }> };

/**
 * 認証・Origin・JSON入力を検証し、固定keyを維持したまま日英表示名を更新します。
 * @param {Request} request - 更新する表示名を含む管理APIリクエスト。
 * @param {RouteContext} context - 営業ステータスコードを含むルートコンテキスト。
 * @returns {Promise<Response>} 更新後の営業ステータス、または入力・存在・設定エラー。
 */
export async function PATCH(request: Request, context: RouteContext) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!process.env.DATABASE_URL) return adminApiErrorResponse("database_unavailable", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  const code = parseAdminStatusCode((await context.params).code);
  if (code === null) return adminApiErrorResponse("invalid_status_code", 400);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  try {
    return Response.json({
      status: await updateAdminPubStatus(code, parseUpdateAdminPubStatusInput(body)),
    });
  } catch (error) {
    return adminStatusErrorResponse(error);
  }
}
