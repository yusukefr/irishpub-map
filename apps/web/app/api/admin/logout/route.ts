import { expiredSessionCookie } from "../../../lib/admin-auth";

/** 管理者セッションCookieを即時失効させます。 */
export function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": expiredSessionCookie() } });
}
