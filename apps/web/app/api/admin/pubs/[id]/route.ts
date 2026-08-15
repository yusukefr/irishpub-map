import { getAdminSession } from "../../../../lib/admin-auth";
import { deletePub, isDatabaseConfigured, updatePub } from "../../../../lib/pub-repository";

function authorized(request: Request) {
  return Boolean(getAdminSession(request.headers.get("cookie")));
}
/**
 * 指定IDの店舗を検証済み入力で更新します。
 * @param {Request} request - 更新対象の店舗データを含むリクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - ルートパラメータ。
 * @param {Promise<{ id: string }>} context.params - 店舗IDを含むパラメータ。
 * @returns {Promise<Response>} 更新結果、または入力・認証エラー。
 */
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
/**
 * 指定IDの店舗を削除し、存在しない場合は404を返します。
 * @param {Request} request - 削除リクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - ルートパラメータ。
 * @param {Promise<{ id: string }>} context.params - 店舗IDを含むパラメータ。
 * @returns {Promise<Response>} 削除結果、または認証・存在確認エラー。
 */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isDatabaseConfigured()) return Response.json({ error: "Database is not configured." }, { status: 503 });
  return (await deletePub((await context.params).id))
    ? Response.json({ ok: true })
    : Response.json({ error: "Not found" }, { status: 404 });
}
