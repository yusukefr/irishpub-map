import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { getMcpOAuthConfig, MCP_REQUIRED_SCOPES, verifyMcpRequest } from "./mcp-auth";
import { registerMcpTools } from "./mcp-tools";

type TokenVerifier = Parameters<typeof withMcpAuth>[1];

/**
 * OAuth 認証を必須にした stateless Remote MCP Handler を構築します。
 * @param verifyToken - OAuth access token の検証処理。通常は Remote JWKS を利用します。
 * @returns Next.js Route Handler から使用する Web 標準 Handler。
 */
export function createAuthenticatedMcpHandler(verifyToken: TokenVerifier = verifyMcpRequest) {
  const mcpHandler = createMcpHandler(registerMcpTools, {
    serverInfo: { name: "irishpub-map", version: "1.0.0" },
    instructions:
      "For Content or Quiz creation, list existing resources first and create drafts only. Generate one idempotencyKey per logical create; reuse the same key and payload for uncertain results. Before update or publication, call get_content or get_quiz, show the target and exact before/after changes, and obtain explicit user confirmation. After every write, call the matching get tool to verify saved values. Never publish during draft creation, invent missing data, or retry a failed create with a new key.",
    verboseLogs: false,
  });

  return async (request: Request): Promise<Response> => {
    const config = getMcpOAuthConfig();
    if (!config) return Response.json({ error: "mcp_not_configured" }, { status: 503 });
    const publicUrl = new URL(config.publicOrigin);
    const host = request.headers.get("host");
    const origin = request.headers.get("origin");
    if ((host && host !== publicUrl.host) || (origin && origin !== config.publicOrigin)) {
      return new Response(null, { status: 403 });
    }
    const secured = withMcpAuth(mcpHandler, verifyToken, {
      required: true,
      requiredScopes: MCP_REQUIRED_SCOPES,
      resourceMetadataPath: "/.well-known/oauth-protected-resource",
      resourceUrl: config.publicOrigin,
    });
    return secured(request);
  };
}
