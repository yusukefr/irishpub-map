import { AdminTagValidationError } from "@irishpub-map/shared/admin-tag";
import { TagRepositoryError } from "./tag-repository";

/**
 * JSONを受け付ける管理タグAPIのContent-Typeを検証します。
 * @param {Request} request - JSON本文を持つ管理APIリクエスト。
 * @returns {Response | null} JSON以外の場合は415、検証成功時はnull。
 */
export function getAdminTagContentTypeError(request: Request) {
  return request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() === "application/json"
    ? null
    : Response.json({ error: "Content-Typeはapplication/jsonを指定してください。" }, { status: 415 });
}

/**
 * 管理タグのValidation・競合・存在・使用中エラーを内部情報なしのHTTPレスポンスへ変換します。
 * @param {unknown} error - 共有ValidationまたはRepositoryから送出されたエラー。
 * @returns {Response} 利用者が対処可能なエラー、または一般化した500レスポンス。
 */
export function adminTagErrorResponse(error: unknown) {
  if (error instanceof AdminTagValidationError) {
    return Response.json({ error: "入力内容を確認してください。", fieldErrors: error.fieldErrors }, { status: 422 });
  }
  if (error instanceof TagRepositoryError) {
    if (error.code === "not_found") return Response.json({ error: "タグが見つかりません。" }, { status: 404 });
    if (error.code === "in_use") return Response.json({ error: "使用中のタグは削除できません。" }, { status: 409 });
    return Response.json({ error: "同じkeyまたは表示名のタグが存在します。" }, { status: 409 });
  }
  return Response.json({ error: "タグを処理できませんでした。" }, { status: 500 });
}

/**
 * Route ParameterがPostgresへ渡せるUUIDかを判定します。
 * @param {string} value - 判定するタグID。
 * @returns {boolean} UUID形式の場合はtrue。
 */
export function isAdminTagId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
