import { createHash, timingSafeEqual } from "node:crypto";

/** Automation APIが認可に使用できるScopeのallow listです。 */
export const AUTOMATION_SCOPES = [
  "master:read",
  "tag:create",
  "content:read",
  "content:create",
  "content:update",
  "content:publish",
  "quiz:read",
  "quiz:create",
  "quiz:update",
  "quiz:publish",
  "pubs:read",
  "pubs:create",
  "pubs:update",
  "pubs:publish",
] as const;

/** Automation APIでEndpointが要求できるScopeです。 */
export type AutomationScope = (typeof AUTOMATION_SCOPES)[number];

/** 認証済みTokenが持つ権限です。将来の複数Token対応時に識別情報を追加できます。 */
export type AutomationPrincipal = {
  scopes: ReadonlySet<AutomationScope>;
};

const allowedScopes: ReadonlySet<string> = new Set(AUTOMATION_SCOPES);
const SHA256_HEX_PATTERN = /^[a-f\d]{64}$/i;
const BEARER_PATTERN = /^Bearer ([^\s]+)$/i;

/**
 * AuthorizationヘッダーのBearer Tokenを設定済みSHA-256と照合します。
 * CookieやOriginはAutomation認証に使用しません。
 * @param {Request} request - Automation APIリクエスト。
 * @returns {AutomationPrincipal | null} 認証済みPrincipal、または認証失敗時のnull。
 */
export function authenticateAutomationRequest(request: Request): AutomationPrincipal | null {
  const token = BEARER_PATTERN.exec(request.headers.get("authorization") ?? "")?.[1];
  const configuredHash = process.env.AUTOMATION_API_TOKEN_SHA256;
  if (!token || !configuredHash || !SHA256_HEX_PATTERN.test(configuredHash)) return null;

  const tokenHash = createHash("sha256").update(token).digest();
  const expectedHash = Buffer.from(configuredHash, "hex");
  if (tokenHash.length !== expectedHash.length || !timingSafeEqual(tokenHash, expectedHash)) return null;

  const scopes = new Set<AutomationScope>();
  for (const value of (process.env.AUTOMATION_API_SCOPES ?? "").split(",")) {
    const scope = value.trim();
    if (allowedScopes.has(scope)) scopes.add(scope as AutomationScope);
  }
  return { scopes };
}

/**
 * 認証済みPrincipalがEndpointの要求Scopeを持つか確認します。
 * @param {AutomationPrincipal} principal - 認証済みAutomation Principal。
 * @param {AutomationScope} requiredScope - Endpointが要求するScope。
 * @returns {boolean} Scopeを保持する場合はtrue。
 */
export function authorizeAutomationScope(principal: AutomationPrincipal, requiredScope: AutomationScope): boolean {
  return principal.scopes.has(requiredScope);
}

/**
 * Automation Route Handlerから使う認証・Scope認可の共通エラーを返します。
 * @param {Request} request - Automation APIリクエスト。
 * @param {AutomationScope} requiredScope - Endpointが要求するScope。
 * @returns {Response | null} 401/403レスポンス、または許可時のnull。
 */
export function getAutomationApiAuthorizationError(request: Request, requiredScope: AutomationScope): Response | null {
  const principal = authenticateAutomationRequest(request);
  if (!principal) return Response.json({ errorCode: "unauthorized" }, { status: 401 });
  if (!authorizeAutomationScope(principal, requiredScope)) {
    return Response.json({ errorCode: "forbidden" }, { status: 403 });
  }
  return null;
}
