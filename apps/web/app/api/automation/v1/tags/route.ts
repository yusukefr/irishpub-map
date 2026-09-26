import { parseCreateAdminTagInput } from "@irishpub-map/shared/admin-tag";
import { adminApiErrorResponse, getAdminJsonContentTypeError } from "../../../../lib/admin-api";
import { adminTagErrorResponse } from "../../../../lib/admin-tag-api";
import { getAutomationApiAuthorizationError } from "../../../../lib/automation-auth";
import { createAdminTag } from "../../../../lib/tag-repository";

/**
 * tag:createを持つAutomation Clientの入力を共有Validationに通し、タグを作成します。
 * @param {Request} request - Bearer Tokenと新規タグ入力を含むリクエスト。
 * @returns {Promise<Response>} 作成したタグ、または認証・入力・競合・設定エラー。
 */
export async function POST(request: Request) {
  const authorizationError = getAutomationApiAuthorizationError(request, "tag:create");
  if (authorizationError) return authorizationError;
  if (!process.env.DATABASE_URL) return adminApiErrorResponse("database_unavailable", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  try {
    return Response.json({ tag: await createAdminTag(parseCreateAdminTagInput(body)) }, { status: 201 });
  } catch (error) {
    return adminTagErrorResponse(error);
  }
}
