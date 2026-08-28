import { expiredSessionCookie } from "../../../lib/admin-auth";
import { getAdminMutationOriginError } from "../../../lib/admin-api";

/**
 * 管理者セッションCookieを即時失効させます。
 * @param {Request} request - Originを含むログアウトリクエスト。
 * @returns {Response} 失効済みCookieを設定したレスポンス、またはOrigin検証エラー。
 */
export function POST(request: Request) {
  const originError = getAdminMutationOriginError(request);
  if (originError) return originError;
  return Response.json({ ok: true }, { headers: { "Set-Cookie": expiredSessionCookie() } });
}
