import { createAuthenticatedMcpHandler } from "../../lib/mcp-server";

export const runtime = "nodejs";

const handler = createAuthenticatedMcpHandler();

/** 認証済み MCP Client の Streamable HTTP request を受けます。 */
export const POST = handler;

/** 旧 Streamable HTTP Client への protocol response も SDK に委ねます。 */
export const GET = handler;
