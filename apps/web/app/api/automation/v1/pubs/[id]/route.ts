import { isPubId } from "@irishpub-map/shared/pub";
import { adminApiErrorResponse, getAdminJsonContentTypeError } from "../../../../../lib/admin-api";
import { adminPubServiceErrorResponse } from "../../../../../lib/admin-pub-api";
import { readAdminPub, updateAdminPub } from "../../../../../lib/admin-pub-service";
import { getAutomationApiAuthorizationError } from "../../../../../lib/automation-auth";
import { handleAutomationMutation } from "../../../../../lib/automation-reliability";
import { isDatabaseConfigured } from "../../../../../lib/pub-repository";

/**
 * pubs:readを持つAutomation Clientへ指定店舗の管理詳細を返します。
 * @param {Request} request - Bearer Tokenを含むリクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - 店舗IDを含むRoute Context。
 * @param {Promise<{ id: string }>} context.params - 店舗ID。
 * @returns {Promise<Response>} 管理店舗詳細、または認証・存在確認エラー。
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorizationError = getAutomationApiAuthorizationError(request, "pubs:read");
  if (authorizationError) return authorizationError;
  if (!isDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const { id } = await context.params;
  if (!isPubId(id)) return adminApiErrorResponse("invalid_request", 400);
  try {
    return Response.json({ pub: await readAdminPub(id) });
  } catch (error) {
    return adminPubServiceErrorResponse(error);
  }
}

/**
 * pubs:updateを持つAutomation Clientが公開状態を維持して店舗全体を更新します。
 * @param {Request} request - Bearer Tokenと管理店舗の全体Snapshotを含むリクエスト。
 * @param {{ params: Promise<{ id: string }> }} context - 店舗IDを含むRoute Context。
 * @param {Promise<{ id: string }>} context.params - 店舗ID。
 * @returns {Promise<Response>} 更新後詳細、または認証・入力・保存エラー。
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleAutomationMutation(request, {
    scope: "pubs:update",
    resourceType: "pub",
    resourceId: isPubId(id) ? id : null,
    execute: () => update(request, context),
  });
}

async function update(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorizationError = getAutomationApiAuthorizationError(request, "pubs:update");
  if (authorizationError) return authorizationError;
  if (!isDatabaseConfigured()) return adminApiErrorResponse("database_unavailable", 503);
  const contentTypeError = getAdminJsonContentTypeError(request);
  if (contentTypeError) return contentTypeError;
  const { id } = await context.params;
  if (!isPubId(id)) return adminApiErrorResponse("invalid_request", 400);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminApiErrorResponse("invalid_json", 400);
  }
  try {
    return Response.json({ pub: await updateAdminPub(id, body) });
  } catch (error) {
    return adminPubServiceErrorResponse(error);
  }
}
