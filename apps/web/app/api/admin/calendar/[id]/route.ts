import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../../lib/admin-api";
import { adminCalendarServiceErrorResponse } from "../../../../lib/admin-calendar-api";
import {
  deleteAdminCalendarEvent,
  readAdminCalendarEvent,
  updateAdminCalendarEvent,
} from "../../../../lib/admin-calendar-service";
import { isCalendarDatabaseConfigured } from "../../../../lib/calendar/repository";
import { isCalendarEventId } from "../../../../lib/calendar/validation";

type Context = { params: Promise<{ id: string }> };

/**
 * 指定Calendar Eventの管理詳細を返します。
 * @param {Request} request - 管理APIリクエスト。
 * @param {Context} context - 動的ルートパラメーター。
 * @returns {Promise<Response>} 詳細レスポンス。
 */
export async function GET(request: Request, context: Context) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!isCalendarDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const { id } = await context.params;
  if (!isCalendarEventId(id)) return adminApiErrorResponse("invalid_request", 400);
  try {
    return Response.json({ event: await readAdminCalendarEvent(id) });
  } catch (error) {
    return adminCalendarServiceErrorResponse(error);
  }
}

/**
 * 指定Calendar Eventを公開状態を維持して全体更新します。
 * @param {Request} request - 管理APIリクエスト。
 * @param {Context} context - 動的ルートパラメーター。
 * @returns {Promise<Response>} 更新結果レスポンス。
 */
export async function PUT(request: Request, context: Context) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!isCalendarDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  const { id } = await context.params;
  if (!isCalendarEventId(id)) return adminApiErrorResponse("invalid_request", 400);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  try {
    return Response.json({ event: await updateAdminCalendarEvent(id, body) });
  } catch (error) {
    return adminCalendarServiceErrorResponse(error);
  }
}

/**
 * 指定Calendar Eventを削除します。
 * @param {Request} request - 管理APIリクエスト。
 * @param {Context} context - 動的ルートパラメーター。
 * @returns {Promise<Response>} 削除結果レスポンス。
 */
export async function DELETE(request: Request, context: Context) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!isCalendarDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const { id } = await context.params;
  if (!isCalendarEventId(id)) return adminApiErrorResponse("invalid_request", 400);
  try {
    await deleteAdminCalendarEvent(id);
    return Response.json({ ok: true });
  } catch (error) {
    return adminCalendarServiceErrorResponse(error);
  }
}
