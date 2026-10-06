import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../../lib/admin-api";
import { adminQuizServiceErrorResponse } from "../../../../lib/admin-quiz-api";
import { updateAdminQuiz, readAdminQuiz } from "../../../../lib/admin-quiz-service";
import { isQuizDatabaseConfigured } from "../../../../lib/quiz/repository";
import { isQuizQuestionId } from "../../../../lib/quiz/types";
type Context = { params: Promise<{ id: string }> };
/**
 * 指定Quizの管理詳細を返します。
 * @param request
 * @param context
 * @returns {Promise<Response>} API response。
 */
export async function GET(request: Request, context: Context) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!isQuizDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const { id } = await context.params;
  if (!isQuizQuestionId(id)) return adminApiErrorResponse("invalid_request", 400);
  try {
    return Response.json({ question: await readAdminQuiz(id) });
  } catch (error) {
    return adminQuizServiceErrorResponse(error);
  }
}
/**
 * 指定Quizを公開状態を維持して全体更新します。
 * @param request
 * @param context
 * @returns {Promise<Response>} API response。
 */
export async function PUT(request: Request, context: Context) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!isQuizDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  const { id } = await context.params;
  if (!isQuizQuestionId(id)) return adminApiErrorResponse("invalid_request", 400);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  try {
    return Response.json({ question: await updateAdminQuiz(id, body) });
  } catch (error) {
    return adminQuizServiceErrorResponse(error);
  }
}
