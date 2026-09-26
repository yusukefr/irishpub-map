import { adminApiErrorResponse, getAdminJsonContentTypeError } from "../../../../../../lib/admin-api";
import { adminQuizServiceErrorResponse } from "../../../../../../lib/admin-quiz-api";
import { getAutomationApiAuthorizationError } from "../../../../../../lib/automation-auth";
import { changeAdminQuizPublication } from "../../../../../../lib/admin-quiz-service";
import { isQuizDatabaseConfigured } from "../../../../../../lib/quiz/repository";
import { isQuizId } from "../../../../../../lib/quiz/types";

type Context = { params: Promise<{ id: string }> };

/**
 * quiz:publishを持つAutomation ClientからQuizの公開状態を変更します。
 * @param {Request} request - Bearer Tokenと公開状態を含むリクエスト。
 * @param {Context} context - Route Parameterを含むContext。
 * @returns {Promise<Response>} 変更結果、または認証・入力・公開条件エラー。
 */
export async function PATCH(request: Request, context: Context) {
  const authorizationError = getAutomationApiAuthorizationError(request, "quiz:publish");
  if (authorizationError) return authorizationError;
  if (!isQuizDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const { id } = await context.params;
  if (!isQuizId(id)) return adminApiErrorResponse("invalid_request", 400);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  const isRecord = body !== null && typeof body === "object" && !Array.isArray(body);
  const keys = body !== null && typeof body === "object" && !Array.isArray(body) ? Object.keys(body) : [];
  if (
    !isRecord ||
    keys.length !== 1 ||
    keys[0] !== "isPublished" ||
    typeof (body as { isPublished?: unknown }).isPublished !== "boolean"
  ) {
    return adminApiErrorResponse("validation_error", 422, { isPublished: "invalid_format" });
  }
  try {
    return Response.json({
      publication: await changeAdminQuizPublication(id, (body as { isPublished: boolean }).isPublished),
    });
  } catch (error) {
    return adminQuizServiceErrorResponse(error);
  }
}
