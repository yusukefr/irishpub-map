import { expiredSessionCookie } from "../../../lib/admin-auth";

/**
 * 管理者セッションCookieを即時失効させます。
 * @returns {Response} 失効済みCookieを設定したレスポンス。
 */
export function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": expiredSessionCookie() } });
}
