import { getAdminSession } from "../../../../lib/admin-auth";
import { deletePub, isDatabaseConfigured, updatePub } from "../../../../lib/pub-repository";

function authorized(request: Request) {
  return Boolean(getAdminSession(request.headers.get("cookie")));
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return Response.json({ error: "Database is not configured." }, { status: 503 });
  try {
    const pub = await updatePub((await context.params).id, await request.json());
    return pub ? Response.json({ pub }) : Response.json({ error: "Not found" }, { status: 404 });
  } catch {
    return Response.json({ error: "店舗データが正しくありません。" }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return Response.json({ error: "Database is not configured." }, { status: 503 });
  return (await deletePub((await context.params).id)) ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}
