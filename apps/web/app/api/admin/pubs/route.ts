import { getAdminSession } from "../../../lib/admin-auth";
import { createPub, getPubs, isDatabaseConfigured } from "../../../lib/pub-repository";

function authorized(request: Request) {
  return Boolean(getAdminSession(request.headers.get("cookie")));
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ pubs: await getPubs(), databaseConfigured: isDatabaseConfigured() });
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return Response.json({ error: "Database is not configured." }, { status: 503 });
  try {
    return Response.json({ pub: await createPub(await request.json()) }, { status: 201 });
  } catch {
    return Response.json({ error: "店舗データが正しくありません。" }, { status: 400 });
  }
}
