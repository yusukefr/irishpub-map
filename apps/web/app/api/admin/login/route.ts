import { createAdminSession, isAdminConfigured, sessionCookie, verifyAdminCredentials } from "../../../lib/admin-auth";
import {
  adminApiErrorResponse,
  getAdminJsonContentTypeError,
  getAdminMutationOriginError,
} from "../../../lib/admin-api";

/**
 * 管理者認証を行い、成功時にHttpOnlyセッションCookieを発行します。
 * @param {Request} request - 認証情報を含むログインリクエスト。
 * @returns {Promise<Response>} 認証結果と、成功時のセッションCookie。
 */
export async function POST(request: Request) {
  const originError = getAdminMutationOriginError(request);
  if (originError) return originError;
  if (!isAdminConfigured()) return adminApiErrorResponse("auth_not_configured", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  if (
    typeof body?.username !== "string" ||
    typeof body.password !== "string" ||
    !(await verifyAdminCredentials(body.username, body.password))
  ) {
    return adminApiErrorResponse("invalid_credentials", 401);
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(createAdminSession(body.username)) } });
}
