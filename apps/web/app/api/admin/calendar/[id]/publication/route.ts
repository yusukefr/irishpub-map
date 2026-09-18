import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../../../lib/admin-api";
import { adminCalendarServiceErrorResponse } from "../../../../../lib/admin-calendar-api";
import { changeAdminCalendarEventPublication } from "../../../../../lib/admin-calendar-service";
import { isCalendarDatabaseConfigured } from "../../../../../lib/calendar/repository";
import { isCalendarEventId } from "../../../../../lib/calendar/validation";

type Context = { params: Promise<{ id: string }> };

/**
 * 指定Calendar Eventを公開またはDraftへ変更します。
 * @param {Request} request - 管理APIリクエスト。
 * @param {Context} context - 動的ルートパラメーター。
 * @returns {Promise<Response>} 公開状態変更レスポンス。
 */
export async function PATCH(request: Request, context: Context) {
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
  const isPublished =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { isPublished?: unknown }).isPublished
      : undefined;
  try {
    return Response.json({ publication: await changeAdminCalendarEventPublication(id, isPublished as boolean) });
  } catch (error) {
    return adminCalendarServiceErrorResponse(error);
  }
}
