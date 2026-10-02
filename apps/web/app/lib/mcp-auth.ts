import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { AuthInfo } from "@modelcontextprotocol/server";

const MCP_READ_SCOPE = "mcp:read";

/** OAuth 認可サーバーと MCP Resource の検証に必要な server-side 設定です。 */
export type McpOAuthConfig = {
  publicOrigin: string;
  issuer: string;
  audience: string;
  jwksUrl: string;
  allowedSubject: string;
};

let remoteKeys: { url: string; keySet: JWTVerifyGetKey } | undefined;

function validUrl(raw: string | undefined, originOnly = false): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const local = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if ((!local && url.protocol !== "https:") || url.username || url.password || url.hash) return null;
    if (originOnly && (url.pathname !== "/" || url.search)) return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * 必須の OAuth 設定が揃わない限り MCP の Tool 利用を拒否します。
 * @returns 検証済み設定、または設定不足時の null。
 */
export function getMcpOAuthConfig(): McpOAuthConfig | null {
  const publicUrl = validUrl(process.env.MCP_PUBLIC_ORIGIN, true);
  const issuerUrl = validUrl(process.env.MCP_OAUTH_ISSUER);
  const jwksUrl = validUrl(process.env.MCP_OAUTH_JWKS_URL);
  const audience = process.env.MCP_OAUTH_AUDIENCE;
  const allowedSubject = process.env.MCP_OAUTH_ALLOWED_SUBJECT;
  if (!publicUrl || !issuerUrl || !jwksUrl || !audience || !allowedSubject) return null;
  // Protected Resource Metadata と JWT 検証で同じ Resource を使う。設定ミスは認証を開かずに拒否する。
  if (audience !== `${publicUrl.origin}/api/mcp`) return null;
  return {
    publicOrigin: publicUrl.origin,
    issuer: issuerUrl.href,
    audience,
    jwksUrl: jwksUrl.href,
    allowedSubject,
  };
}

/**
 * 外部 OAuth サーバーの署名・Issuer・Audience・期限・管理者 Subject を検証します。
 * @param token - MCP Client が提示した OAuth access token。
 * @param config - Server 側の OAuth 設定。
 * @param keySet - 認可サーバーの検証鍵。通常は Remote JWKS。
 * @returns 検証成功時の MCP AuthInfo。失敗時は undefined。
 */
export async function verifyMcpAccessToken(
  token: string,
  config: McpOAuthConfig,
  keySet: JWTVerifyGetKey,
): Promise<AuthInfo | undefined> {
  try {
    const { payload } = await jwtVerify(token, keySet, {
      issuer: config.issuer,
      audience: config.audience,
      requiredClaims: ["exp", "iat", "sub"],
      algorithms: ["RS256", "ES256"],
    });
    if (payload.sub !== config.allowedSubject) return undefined;
    const scopes = typeof payload.scope === "string" ? payload.scope.split(/\s+/).filter(Boolean) : [];
    const clientId =
      typeof payload.client_id === "string"
        ? payload.client_id
        : typeof payload.azp === "string"
          ? payload.azp
          : "oauth-client";
    return { token, clientId, scopes };
  } catch {
    return undefined;
  }
}

/**
 * MCP Endpoint が提示する OAuth Bearer Token を検証します。
 * @param _request - 認証 Handler が受け取る Request。Cookie は認証経路にしません。
 * @param bearerToken - Authorization Header から抽出された Token。
 * @returns 検証済み AuthInfo。未認証時は undefined。
 */
export async function verifyMcpRequest(_request: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  const config = getMcpOAuthConfig();
  if (!config || !bearerToken) return undefined;
  if (remoteKeys?.url !== config.jwksUrl) {
    remoteKeys = { url: config.jwksUrl, keySet: createRemoteJWKSet(new URL(config.jwksUrl)) };
  }
  return verifyMcpAccessToken(bearerToken, config, remoteKeys.keySet);
}

/** MCP User に必要な OAuth Scope。Automation API の `master:read` とは別です。 */
export const MCP_REQUIRED_SCOPES = [MCP_READ_SCOPE];
