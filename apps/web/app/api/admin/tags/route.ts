import { parseCreateAdminTagInput } from "@irishpub-map/shared/admin-tag";
import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../lib/admin-api";
import { adminTagErrorResponse } from "../../../lib/admin-tag-api";
import { createAdminTag, getAdminTags } from "../../../lib/tag-repository";

/**
 * 認証済み管理者へ日英表示名と使用店舗数を含むタグ一覧を返します。
 * @param {Request} request - 管理者セッションを含むリクエスト。
 * @returns {Promise<Response>} 管理タグ一覧、または認証・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  try {
    return Response.json({ tags: await getAdminTags(), databaseConfigured: Boolean(process.env.DATABASE_URL) });
  } catch (error) {
    return adminTagErrorResponse(error);
  }
}

/**
 * 認証・Origin・JSON入力を検証し、タグ本体と翻訳をtransactionで登録します。
 * @param {Request} request - 新規タグ入力を含む管理APIリクエスト。
 * @returns {Promise<Response>} 登録したタグ、または入力・競合・設定エラー。
 */
export async function POST(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!process.env.DATABASE_URL) return adminApiErrorResponse("database_unavailable", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  try {
    return Response.json({ tag: await createAdminTag(parseCreateAdminTagInput(body)) }, { status: 201 });
  } catch (error) {
    return adminTagErrorResponse(error);
  }
}
