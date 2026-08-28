import { createAdminSession, isAdminConfigured, sessionCookie, verifyAdminCredentials } from "../../../lib/admin-auth";
import { getAdminMutationOriginError } from "../../../lib/admin-api";

/**
 * 管理者認証を行い、成功時にHttpOnlyセッションCookieを発行します。
 * @param {Request} request - 認証情報を含むログインリクエスト。
 * @returns {Promise<Response>} 認証結果と、成功時のセッションCookie。
 */
export async function POST(request: Request) {
  const originError = getAdminMutationOriginError(request);
  if (originError) return originError;
  if (!isAdminConfigured()) return Response.json({ error: "Admin authentication is not configured." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  if (
    typeof body?.username !== "string" ||
    typeof body.password !== "string" ||
    !(await verifyAdminCredentials(body.username, body.password))
  ) {
    return Response.json({ error: "ID またはパスワードが正しくありません。" }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(createAdminSession(body.username)) } });
}
