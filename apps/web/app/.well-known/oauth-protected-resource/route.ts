import { metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";
import { getMcpOAuthConfig } from "../../lib/mcp-auth";

export const runtime = "nodejs";

/**
 * OAuth Client に保護対象の MCP Resource と認可サーバーを通知します。
 * @param request - Metadata の HTTP Request。
 * @returns RFC 9728 Metadata または設定不足の Response。
 */
export function GET(request: Request): Response {
  const config = getMcpOAuthConfig();
  if (!config) return Response.json({ error: "mcp_not_configured" }, { status: 503 });
  return protectedResourceHandler({
    authServerUrls: [config.issuer],
    resourceUrl: `${config.publicOrigin}/api/mcp`,
  })(request);
}

/** Browser-based OAuth Client に metadata の参照を許可します。 */
export const OPTIONS = metadataCorsOptionsRequestHandler();
