// @vitest-environment node
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getProtectedResource } from "../../apps/web/app/.well-known/oauth-protected-resource/route";
import { createAuthenticatedMcpHandler } from "../../apps/web/app/lib/mcp-server";
import { MCP_TOOL_ALLOW_LIST } from "../../apps/web/app/lib/mcp-tools";

const envKeys = [
  "MCP_PUBLIC_ORIGIN",
  "MCP_OAUTH_ISSUER",
  "MCP_OAUTH_AUDIENCE",
  "MCP_OAUTH_JWKS_URL",
  "MCP_OAUTH_ALLOWED_SUBJECT",
  "MCP_AUTOMATION_API_ORIGIN",
  "MCP_AUTOMATION_API_TOKEN",
] as const;
const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
let clientToken: string;
const MODERN_PROTOCOL_VERSION = "2026-07-28";
const LEGACY_PROTOCOL_VERSION = "2025-06-18";

beforeEach(() => {
  process.env.MCP_PUBLIC_ORIGIN = "https://example.test";
  process.env.MCP_OAUTH_ISSUER = "https://issuer.example.test/";
  process.env.MCP_OAUTH_AUDIENCE = "https://example.test/api/mcp";
  process.env.MCP_OAUTH_JWKS_URL = "https://issuer.example.test/jwks";
  process.env.MCP_OAUTH_ALLOWED_SUBJECT = "admin-subject";
  process.env.MCP_AUTOMATION_API_ORIGIN = "https://example.test";
  process.env.MCP_AUTOMATION_API_TOKEN = randomBytes(32).toString("hex");
  clientToken = randomBytes(32).toString("hex");
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of envKeys) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function createHandler(scopes = ["mcp:read"]) {
  return createAuthenticatedMcpHandler(async (_request, bearerToken) =>
    bearerToken === clientToken ? { token: bearerToken, clientId: "test-client", scopes } : undefined,
  );
}

function mcpRequest(
  method: string,
  params?: Record<string, unknown>,
  bearer = clientToken,
  protocolVersion: typeof MODERN_PROTOCOL_VERSION | typeof LEGACY_PROTOCOL_VERSION = MODERN_PROTOCOL_VERSION,
): Request {
  const modern = protocolVersion === MODERN_PROTOCOL_VERSION;
  return new Request("https://example.test/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": protocolVersion,
      ...(modern ? { "Mcp-Method": method } : {}),
      ...(modern && method === "tools/call" ? { "Mcp-Name": String(params?.name) } : {}),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      ...(modern
        ? {
            params: {
              ...params,
              _meta: {
                "io.modelcontextprotocol/protocolVersion": MODERN_PROTOCOL_VERSION,
                "io.modelcontextprotocol/clientInfo": { name: "contract-test", version: "1.0.0" },
                "io.modelcontextprotocol/clientCapabilities": {},
              },
            },
          }
        : params
          ? { params }
          : {}),
    }),
  });
}

async function mcpBody(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const payload =
    text.startsWith("event:") || text.startsWith("data:")
      ? text
          .split("\n")
          .find((line) => line.startsWith("data: "))
          ?.slice(6)
      : text;
  return JSON.parse(payload ?? "null") as Record<string, unknown>;
}

describe("Remote MCP contract", () => {
  it("fails closed when OAuth audience and protected resource differ", async () => {
    process.env.MCP_OAUTH_AUDIENCE = "https://another-resource.example.test/api/mcp";
    const verifyToken = vi.fn();
    const response = await createAuthenticatedMcpHandler(verifyToken)(mcpRequest("tools/list"));
    expect(response.status).toBe(503);
    expect(verifyToken).not.toHaveBeenCalled();
    expect(getProtectedResource(new Request("https://example.test/.well-known/oauth-protected-resource")).status).toBe(
      503,
    );
  });

  it("rejects unauthenticated discovery and keeps OAuth metadata separate", async () => {
    const response = await createHandler()(mcpRequest("server/discover", undefined, ""));
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("resource_metadata");

    const metadata = getProtectedResource(new Request("https://example.test/.well-known/oauth-protected-resource"));
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toMatchObject({
      resource: "https://example.test/api/mcp",
      authorization_servers: ["https://issuer.example.test/"],
    });
  });

  it("serves 2026-07-28 discovery, the reviewed read-only tool, and an Automation API call", async () => {
    const handler = createHandler();
    const discovered = await handler(mcpRequest("server/discover"));
    expect(discovered.status).toBe(200);
    expect(JSON.stringify((await mcpBody(discovered)).result)).toContain(MODERN_PROTOCOL_VERSION);

    const listed = await handler(mcpRequest("tools/list"));
    expect(listed.status).toBe(200);
    const listResult = (await mcpBody(listed)).result as { tools: Array<Record<string, unknown>> };
    expect(listResult.tools.map((tool) => tool.name)).toEqual([...MCP_TOOL_ALLOW_LIST]);
    expect(new Set(listResult.tools.map((tool) => tool.name)).size).toBe(listResult.tools.length);
    expect(listResult.tools).toHaveLength(1);
    expect(listResult.tools[0].annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(listResult.tools[0].description).toContain("master:read");

    const fetchMock = vi.fn().mockResolvedValue(Response.json({ prefectures: [{ code: 13, name: "Tokyo" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const called = await handler(mcpRequest("tools/call", { name: "list_prefectures", arguments: {} }));
    expect(called.status).toBe(200);
    const toolResult = (await mcpBody(called)).result as Record<string, unknown>;
    expect(toolResult.structuredContent).toEqual({ prefectures: [{ code: 13, name: "Tokyo" }] });
    expect(JSON.stringify(toolResult)).not.toContain(process.env.MCP_AUTOMATION_API_TOKEN);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("still supports the 2025-06-18 initialize handshake", async () => {
    const handler = createHandler();
    const initialized = await handler(
      mcpRequest(
        "initialize",
        {
          protocolVersion: LEGACY_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "contract-test", version: "1.0.0" },
        },
        clientToken,
        LEGACY_PROTOCOL_VERSION,
      ),
    );
    expect(initialized.status).toBe(200);
    expect((await mcpBody(initialized)).result).toMatchObject({ protocolVersion: LEGACY_PROTOCOL_VERSION });
  });

  it("rejects insufficient MCP scope before an Automation API call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await createHandler([])(mcpRequest("tools/call", { name: "list_prefectures", arguments: {} }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns Automation API errors as tool errors without forwarding secrets", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ errorCode: "forbidden", extra: process.env.MCP_AUTOMATION_API_TOKEN }, { status: 403 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const called = await createHandler()(mcpRequest("tools/call", { name: "list_prefectures", arguments: {} }));
    const toolResult = (await mcpBody(called)).result as Record<string, unknown>;
    expect(toolResult.isError).toBe(true);
    expect(toolResult.content).toEqual([
      { type: "text", text: JSON.stringify({ source: "automation_api", status: 403, errorCode: "forbidden" }) },
    ]);
    expect(JSON.stringify(toolResult)).not.toContain(process.env.MCP_AUTOMATION_API_TOKEN);
  });

  it("keeps the tool allow list and Automation OpenAPI path aligned", () => {
    const openapi = readFileSync(resolve(import.meta.dirname, "../../docs/specs/openapi/openapi.yaml"), "utf8");
    const masterPaths = readFileSync(
      resolve(import.meta.dirname, "../../docs/specs/openapi/paths/automation-master.yaml"),
      "utf8",
    );
    expect(openapi).toContain("/api/automation/v1/master/prefectures:");
    expect(masterPaths).toMatch(/Prefectures:\s+get:[\s\S]*?x-required-scope: master:read/);
    expect(MCP_TOOL_ALLOW_LIST).toEqual(["list_prefectures"]);
  });
});
