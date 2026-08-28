import { parseUpdateAdminTagInput } from "@irishpub-map/shared/admin-tag";
import { getAdminApiAuthorizationError } from "../../../../lib/admin-api";
import { adminTagErrorResponse, getAdminTagContentTypeError, isAdminTagId } from "../../../../lib/admin-tag-api";
import { deleteAdminTag, updateAdminTag } from "../../../../lib/tag-repository";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * 認証・Origin・JSON入力を検証し、タグの内部キーを維持したまま日英表示名を更新します。
 * @param {Request} request - 更新する表示名を含む管理APIリクエスト。
 * @param {RouteContext} context - タグIDを含むルートコンテキスト。
 * @returns {Promise<Response>} 更新したタグ、または入力・競合・存在エラー。
 */
export async function PATCH(request: Request, context: RouteContext) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database is not configured." }, { status: 503 });
  const contentTypeError = getAdminTagContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  const { id } = await context.params;
  if (!isAdminTagId(id)) return Response.json({ error: "タグIDが正しくありません。" }, { status: 400 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON本文が正しくありません。" }, { status: 400 });
  }
  try {
    return Response.json({ tag: await updateAdminTag(id, parseUpdateAdminTagInput(body)) });
  } catch (error) {
    return adminTagErrorResponse(error);
  }
}

/**
 * 認証・Originを検証し、店舗から未使用のタグだけを削除します。
 * @param {Request} request - 削除するタグへの管理APIリクエスト。
 * @param {RouteContext} context - タグIDを含むルートコンテキスト。
 * @returns {Promise<Response>} 削除結果、または使用中・存在・設定エラー。
 */
export async function DELETE(request: Request, context: RouteContext) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!process.env.DATABASE_URL) return Response.json({ error: "Database is not configured." }, { status: 503 });
  const { id } = await context.params;
  if (!isAdminTagId(id)) return Response.json({ error: "タグIDが正しくありません。" }, { status: 400 });
  try {
    await deleteAdminTag(id);
    return Response.json({ ok: true });
  } catch (error) {
    return adminTagErrorResponse(error);
  }
}
