import { adminApiErrorResponse, getAdminJsonContentTypeError } from "../../../../lib/admin-api";
import { adminQuizServiceErrorResponse } from "../../../../lib/admin-quiz-api";
import { getAutomationApiAuthorizationError } from "../../../../lib/automation-auth";
import { handleAutomationCreate } from "../../../../lib/automation-reliability";
import { createAdminQuiz, readAdminQuizList } from "../../../../lib/admin-quiz-service";
import { isQuizDatabaseConfigured } from "../../../../lib/quiz/repository";
import { getAdminQuizQuestion } from "../../../../lib/quiz/repository";

/**
 * quiz:readを持つAutomation ClientへDraftを含むQuiz一覧を返します。
 * @param {Request} request - Bearer Tokenを含むリクエスト。
 * @returns {Promise<Response>} Quiz一覧、または認証・取得エラー。
 */
export async function GET(request: Request) {
  const authorizationError = getAutomationApiAuthorizationError(request, "quiz:read");
  if (authorizationError) return authorizationError;
  if (!isQuizDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  try {
    return Response.json({ questions: await readAdminQuizList() });
  } catch {
    return adminApiErrorResponse("internal_error", 500);
  }
}

/**
 * quiz:createを持つAutomation ClientからQuiz Draftを作成します。
 * @param {Request} request - Bearer TokenとQuiz入力を含むリクエスト。
 * @returns {Promise<Response>} 作成したDraft、または認証・入力・作成エラー。
 */
export async function POST(request: Request) {
  return handleAutomationCreate(request, {
    scope: "quiz:create",
    resourceType: "quiz",
    execute: (id) => create(request, id),
    recover: (id) => getAdminQuizQuestion(id),
  });
}

async function create(request: Request, id: string) {
  const authorizationError = getAutomationApiAuthorizationError(request, "quiz:create");
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
    return Response.json({ question: await createAdminQuiz(body, id) }, { status: 201 });
  } catch (error) {
    return adminQuizServiceErrorResponse(error);
  }
}
