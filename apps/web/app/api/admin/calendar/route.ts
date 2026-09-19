import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../lib/admin-api";
import { adminCalendarServiceErrorResponse } from "../../../lib/admin-calendar-api";
import { createAdminCalendarEvent, readAdminCalendarList } from "../../../lib/admin-calendar-service";
import { isCalendarDatabaseConfigured } from "../../../lib/calendar/repository";

/**
 * 認証済み管理者へDraftを含むCalendar一覧を返します。
 * @param {Request} request - 管理APIリクエスト。
 * @returns {Promise<Response>} 一覧レスポンス。
 */
export async function GET(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  try {
    return Response.json({
      events: await readAdminCalendarList(),
      databaseConfigured: isCalendarDatabaseConfigured(),
    });
  } catch {
    return adminApiErrorResponse("internal_error", 500);
  }
}

/**
 * 認証済み管理者がCalendar EventをDraft作成します。
 * @param {Request} request - 管理APIリクエスト。
 * @returns {Promise<Response>} 作成結果レスポンス。
 */
export async function POST(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!isCalendarDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  try {
    return Response.json({ event: await createAdminCalendarEvent(body) }, { status: 201 });
  } catch (error) {
    return adminCalendarServiceErrorResponse(error);
  }
}
