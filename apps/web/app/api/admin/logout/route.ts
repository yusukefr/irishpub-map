import { expiredSessionCookie } from "../../../lib/admin-auth";

export function POST() {
  return Response.json({ ok: true }, { headers: { "Set-Cookie": expiredSessionCookie() } });
}
