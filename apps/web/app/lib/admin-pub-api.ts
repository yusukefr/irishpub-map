import { adminApiErrorResponse } from "./admin-api";
import { AdminPubServiceError } from "./admin-pub-service";

/**
 * 管理用・Automation用のPub Serviceエラーを同じHTTP契約へ変換します。
 * @param {unknown} error - Pub Serviceが返した例外。
 * @returns {Response} 内部情報を含まない機械可読エラー。
 */
export function adminPubServiceErrorResponse(error: unknown): Response {
  if (!(error instanceof AdminPubServiceError)) return adminApiErrorResponse("internal_error", 500);
  if (error.code === "not_found") return adminApiErrorResponse("pub_not_found", 404);
  if (error.code === "validation") return adminApiErrorResponse("validation_error", 422, error.fieldErrors);
  if (error.code === "reference_conflict") {
    return adminApiErrorResponse("validation_error", 409, error.fieldErrors);
  }
  return Response.json(
    { errorCode: "publication_requirements_not_met", missingFields: error.missingFields },
    { status: 422 },
  );
}
