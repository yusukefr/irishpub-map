import { adminApiErrorResponse } from "./admin-api";
import { AdminCalendarServiceError } from "./admin-calendar-service";

/** Calendar Serviceの業務エラーを共通管理APIレスポンスへ変換します。
 * @param error
 * @returns {Response} 内部情報を含まないエラーレスポンス。
 */
export function adminCalendarServiceErrorResponse(error: unknown): Response {
  if (!(error instanceof AdminCalendarServiceError)) return adminApiErrorResponse("internal_error", 500);
  if (error.code === "not_found") return adminApiErrorResponse("calendar_not_found", 404);
  if (error.code === "conflict") return adminApiErrorResponse("calendar_conflict", 409, error.fieldErrors);
  if (error.code === "validation") return adminApiErrorResponse("validation_error", 422, error.fieldErrors);
  return Response.json(
    {
      errorCode: "publication_requirements_not_met",
      fieldErrors: error.fieldErrors,
      missingFields: error.missingFields,
    },
    { status: 422 },
  );
}
