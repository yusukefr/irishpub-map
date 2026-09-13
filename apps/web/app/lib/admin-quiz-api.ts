import { adminApiErrorResponse } from "./admin-api";
import { AdminQuizServiceError } from "./admin-quiz-service";
/**
 * Quiz Serviceの業務エラーを共通管理APIレスポンスへ変換します。
 * @param error
 * @returns {Response} 管理APIエラーレスポンス。
 */
export function adminQuizServiceErrorResponse(error: unknown): Response {
  if (!(error instanceof AdminQuizServiceError)) return adminApiErrorResponse("internal_error", 500);
  if (error.code === "not_found") return adminApiErrorResponse("quiz_not_found", 404);
  if (error.code === "conflict") return adminApiErrorResponse("quiz_conflict", 409, error.fieldErrors);
  if (error.code === "validation") return adminApiErrorResponse("validation_error", 422, error.fieldErrors);
  return Response.json(
    { errorCode: "publication_requirements_not_met", missingFields: error.missingFields },
    { status: 422 },
  );
}
