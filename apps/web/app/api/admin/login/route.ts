import { createAdminSession, isAdminConfigured, sessionCookie, verifyAdminCredentials } from "../../../lib/admin-auth";

export async function POST(request: Request) {
  if (!isAdminConfigured()) return Response.json({ error: "Admin authentication is not configured." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { username?: unknown; password?: unknown } | null;
  if (typeof body?.username !== "string" || typeof body.password !== "string" || !(await verifyAdminCredentials(body.username, body.password))) {
    return Response.json({ error: "ID またはパスワードが正しくありません。" }, { status: 401 });
  }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(createAdminSession(body.username)) } });
}
