import { adminApiErrorResponse, getAdminJsonContentTypeError } from "../../../../../lib/admin-api";
import { adminQuizServiceErrorResponse } from "../../../../../lib/admin-quiz-api";
import { getAutomationApiAuthorizationError } from "../../../../../lib/automation-auth";
import { readAdminQuiz, updateAdminQuiz } from "../../../../../lib/admin-quiz-service";
import { isQuizDatabaseConfigured } from "../../../../../lib/quiz/repository";
import { isQuizId } from "../../../../../lib/quiz/types";

type Context = { params: Promise<{ id: string }> };

/**
 * quiz:readを持つAutomation Clientへ指定Quizの管理詳細を返します。
 * @param {Request} request - Bearer Tokenを含むリクエスト。
 * @param {Context} context - Route Parameterを含むContext。
 * @returns {Promise<Response>} Quiz詳細、または認証・取得エラー。
 */
export async function GET(request: Request, context: Context) {
  const authorizationError = getAutomationApiAuthorizationError(request, "quiz:read");
  if (authorizationError) return authorizationError;
  if (!isQuizDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const { id } = await context.params;
  if (!isQuizId(id)) return adminApiErrorResponse("invalid_request", 400);
  try {
    return Response.json({ question: await readAdminQuiz(id) });
  } catch (error) {
    return adminQuizServiceErrorResponse(error);
  }
}

/**
 * quiz:updateを持つAutomation ClientからQuiz全体を更新します。
 * @param {Request} request - Bearer TokenとQuiz入力を含むリクエスト。
 * @param {Context} context - Route Parameterを含むContext。
 * @returns {Promise<Response>} 更新したQuiz、または認証・入力・更新エラー。
 */
export async function PUT(request: Request, context: Context) {
  const authorizationError = getAutomationApiAuthorizationError(request, "quiz:update");
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
  try {
    return Response.json({ question: await updateAdminQuiz(id, body) });
  } catch (error) {
    return adminQuizServiceErrorResponse(error);
  }
}
