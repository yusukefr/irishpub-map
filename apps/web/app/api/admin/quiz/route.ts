import {
  adminApiErrorResponse,
  getAdminApiAuthorizationError,
  getAdminJsonContentTypeError,
} from "../../../lib/admin-api";
import { adminQuizServiceErrorResponse } from "../../../lib/admin-quiz-api";
import { isQuizDatabaseConfigured } from "../../../lib/quiz/repository";
import { createAdminQuiz, readAdminQuizList } from "../../../lib/admin-quiz-service";
/**
 * 認証済み管理者へDraftを含むQuiz一覧を返します。
 * @param request
 * @returns {Promise<Response>} API response。
 */
export async function GET(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  try {
    return Response.json({ questions: await readAdminQuizList(), databaseConfigured: isQuizDatabaseConfigured() });
  } catch {
    return adminApiErrorResponse("internal_error", 500);
  }
}
/**
 * 認証済み管理者がQuizをDraft作成します。
 * @param request
 * @returns {Promise<Response>} API response。
 */
export async function POST(request: Request) {
  const authorizationError = getAdminApiAuthorizationError(request);
  if (authorizationError) return authorizationError;
  if (!isQuizDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  try {
    return Response.json({ question: await createAdminQuiz(body) }, { status: 201 });
  } catch (error) {
    return adminQuizServiceErrorResponse(error);
  }
}
