import { adminApiErrorResponse } from "./admin-api";
import { AdminContentServiceError } from "./admin-content-service";

/**
 * Content Serviceの業務エラーを共通管理APIレスポンスへ変換します。
 * @param {unknown} error - Serviceから送出されたエラー。
 * @returns {Response} 内部情報を含まないエラーレスポンス。
 */
export function adminContentServiceErrorResponse(error: unknown): Response {
  if (!(error instanceof AdminContentServiceError)) return adminApiErrorResponse("internal_error", 500);
  if (error.code === "not_found") return adminApiErrorResponse("content_not_found", 404);
  if (error.code === "validation") return adminApiErrorResponse("validation_error", 422, error.fieldErrors);
  if (error.code === "conflict") return adminApiErrorResponse("content_conflict", 409, error.fieldErrors);
  return Response.json(
    { errorCode: "publication_requirements_not_met", missingFields: error.missingFields },
    { status: 422 },
  );
}
