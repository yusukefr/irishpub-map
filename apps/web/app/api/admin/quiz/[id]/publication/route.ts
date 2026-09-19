import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../../../lib/admin-api";
import { adminQuizServiceErrorResponse } from "../../../../../lib/admin-quiz-api";
import { changeAdminQuizPublication } from "../../../../../lib/admin-quiz-service";
import { isQuizDatabaseConfigured } from "../../../../../lib/quiz/repository";
import { isQuizId } from "../../../../../lib/quiz/types";
type Context = { params: Promise<{ id: string }> };
/**
 * Quizの公開状態を変更します。
 * @param request
 * @param context
 * @returns {Promise<Response>} API response。
 */
export async function PATCH(request: Request, context: Context) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!isQuizDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  const { id } = await context.params;
  if (!isQuizId(id)) return adminApiErrorResponse("invalid_request", 400);
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
    return Response.json({ publication: await changeAdminQuizPublication(id, isPublished as boolean) });
  } catch (error) {
    return adminQuizServiceErrorResponse(error);
  }
}
