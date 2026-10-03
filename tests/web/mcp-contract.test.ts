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
const id = "123e4567-e89b-42d3-a456-426614174000";
const timestamp = "2026-01-01T00:00:00.000Z";
const contentBase = {
  id,
  kind: "story",
  slug: "sample",
  category: "history",
  status: "draft",
  publishedAt: null,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const quizBase = {
  id: "sample-quiz",
  category: null,
  specialDate: null,
  correctChoiceId: null,
  sourceUrl: null,
  relatedContentId: null,
  imageAssetId: null,
  isPublished: false,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const pubBase = {
  id,
  isPublished: false,
  prefectureCode: 13,
  municipalityCode: "131016",
  latitude: 35,
  longitude: 139,
  websiteUrl: "https://example.test",
  googleMapsUrl: null,
  instagramUrl: null,
  status: "open",
  translations: { ja: { name: "Sample", nameReading: null, address: "Tokyo" }, en: null },
  tagIds: [id],
  updatedAt: timestamp,
};

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
    const metadataUrl = "https://example.test/.well-known/oauth-protected-resource";
    expect(response.headers.get("WWW-Authenticate")).toContain(`resource_metadata="${metadataUrl}"`);

    const getResponse = await createHandler()(new Request("https://example.test/api/mcp"));
    expect(getResponse.status).toBe(401);
    expect(getResponse.headers.get("WWW-Authenticate")).toContain(`resource_metadata="${metadataUrl}"`);

    const metadata = getProtectedResource(new Request(metadataUrl));
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toMatchObject({
      resource: "https://example.test/api/mcp",
      authorization_servers: ["https://issuer.example.test/"],
    });
  });

  it("serves 2026-07-28 discovery, the reviewed read-only tools, and an Automation API call", async () => {
    const handler = createHandler();
    const discovered = await handler(mcpRequest("server/discover"));
    expect(discovered.status).toBe(200);
    expect(JSON.stringify((await mcpBody(discovered)).result)).toContain(MODERN_PROTOCOL_VERSION);

    const listed = await handler(mcpRequest("tools/list"));
    expect(listed.status).toBe(200);
    const listResult = (await mcpBody(listed)).result as { tools: Array<Record<string, unknown>> };
    expect(listResult.tools.map((tool) => tool.name)).toEqual([...MCP_TOOL_ALLOW_LIST]);
    expect(new Set(listResult.tools.map((tool) => tool.name)).size).toBe(listResult.tools.length);
    expect(listResult.tools).toHaveLength(10);
    const scopes = [
      "master:read",
      "master:read",
      "master:read",
      "master:read",
      "content:read",
      "content:read",
      "quiz:read",
      "quiz:read",
      "pubs:read",
      "pubs:read",
    ];
    for (const [index, tool] of listResult.tools.entries()) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
      expect(tool.description).toContain(scopes[index]);
      expect(tool.description).toContain("Read-only");
    }

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

  it("maps all read tools to GET endpoints and preserves validated structured responses", async () => {
    const cases = [
      {
        name: "list_prefectures",
        args: {},
        path: "/master/prefectures",
        data: { prefectures: [{ code: 13, name: "Tokyo" }] },
      },
      {
        name: "list_municipalities",
        args: { prefectureCode: 13 },
        path: "/master/municipalities?prefectureCode=13",
        data: { municipalities: [{ code: "131016", prefectureCode: 13, name: "Chiyoda" }] },
      },
      {
        name: "list_tags",
        args: {},
        path: "/master/tags",
        data: { tags: [{ id, key: "irish", translations: { ja: "Irish" }, pubCount: 1 }] },
      },
      {
        name: "list_pub_statuses",
        args: {},
        path: "/master/statuses",
        data: { statuses: [{ code: 1, key: "open", name: "Open" }] },
      },
      {
        name: "list_content",
        args: {},
        path: "/content",
        data: { content: [{ ...contentBase, titleJa: "記事", titleEn: "Story" }], databaseConfigured: true },
      },
      {
        name: "get_content",
        args: { id },
        path: `/content/${id}`,
        data: {
          content: {
            ...contentBase,
            heroImageAssetId: null,
            heroImage: null,
            translations: {
              ja: { title: "記事", summary: "概要", bodyMarkdown: "本文", heroImageAlt: "", heroImageCaption: "" },
              en: { title: "Story", summary: "Summary", bodyMarkdown: "Body", heroImageAlt: "", heroImageCaption: "" },
            },
          },
        },
      },
      {
        name: "list_quizzes",
        args: {},
        path: "/quiz",
        data: { questions: [{ ...quizBase, questionJa: "質問", questionEn: "Question", choiceCount: 0 }] },
      },
      {
        name: "get_quiz",
        args: { id: "sample-quiz" },
        path: "/quiz/sample-quiz",
        data: {
          question: {
            ...quizBase,
            image: null,
            translations: {
              ja: { question: "質問", explanation: "説明", sourceLabel: "出典", imageAlt: "", imageCaption: "" },
              en: {
                question: "Question",
                explanation: "Explanation",
                sourceLabel: "Source",
                imageAlt: "",
                imageCaption: "",
              },
            },
            choices: [{ id: "first", sortOrder: 0, translations: { ja: "一", en: "One" } }],
          },
        },
      },
      {
        name: "list_pubs",
        args: {
          name: "Irish",
          prefecture: 13,
          municipality: "131016",
          status: "open",
          tag: id,
          published: false,
          page: 2,
        },
        path: `/pubs?name=Irish&prefecture=13&municipality=131016&status=open&tag=${id}&published=false&page=2`,
        data: {
          pubs: [
            {
              id,
              name: "Sample",
              kana: null,
              prefecture: "Tokyo",
              city: "Chiyoda",
              municipalityCode: "131016",
              address: "Tokyo",
              latitude: 35,
              longitude: 139,
              websiteUrl: "https://example.test",
              googleMapsUrl: null,
              instagramUrl: null,
              tags: ["irish"],
              tagDisplayNames: { irish: "Irish" },
              status: "open",
              prefectureCode: 13,
              statusCode: 1,
              statusDisplayName: "Open",
              tagItems: [{ id, key: "irish", name: "Irish" }],
              isPublished: false,
              updatedAt: timestamp,
            },
          ],
          total: 51,
          page: 2,
          pageSize: 50,
          databaseConfigured: true,
        },
      },
      { name: "get_pub", args: { id }, path: `/pubs/${id}`, data: { pub: pubBase } },
    ];
    const handler = createHandler();
    for (const item of cases) {
      const fetchMock = vi.fn().mockResolvedValue(Response.json(item.data));
      vi.stubGlobal("fetch", fetchMock);
      const response = await handler(mcpRequest("tools/call", { name: item.name, arguments: item.args }));
      const result = (await mcpBody(response)).result as Record<string, unknown>;
      expect(result.isError, item.name).not.toBe(true);
      expect(result.structuredContent, item.name).toEqual(item.data);
      expect(result.content, item.name).toEqual([{ type: "text", text: JSON.stringify(item.data) }]);
      expect(JSON.stringify(result)).not.toContain(process.env.MCP_AUTOMATION_API_TOKEN);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
      expect(`${url.pathname}${url.search}`, item.name).toBe(`/api/automation/v1${item.path}`);
      expect(init.method, item.name).toBe("GET");
      expect(init.body, item.name).toBeUndefined();
    }
  });

  it("rejects unknown inputs and fails closed on invalid responses", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const handler = createHandler();
    for (const [name, args] of [
      ["list_municipalities", { prefectureCode: 99 }],
      ["list_pubs", { limit: 10 }],
      ["list_pubs", { page: 0 }],
      ["get_pub", { id: "../content" }],
    ] as const) {
      const result = (await mcpBody(await handler(mcpRequest("tools/call", { name, arguments: args }))))
        .result as Record<string, unknown>;
      expect(result.isError).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    }
    fetchMock.mockResolvedValue(
      Response.json({
        pubs: [],
        page: 1,
        pageSize: 100,
        total: 0,
        databaseConfigured: true,
        secret: process.env.MCP_AUTOMATION_API_TOKEN,
      }),
    );
    const result = (await mcpBody(await handler(mcpRequest("tools/call", { name: "list_pubs", arguments: {} }))))
      .result as Record<string, unknown>;
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain("invalid_response");
    expect(JSON.stringify(result)).not.toContain(process.env.MCP_AUTOMATION_API_TOKEN);
  });

  it.each([
    [400, "invalid_request"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "pub_not_found"],
    [503, "database_unavailable"],
  ])("preserves safe Automation API %i errors", async (status, errorCode) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ errorCode }, { status }));
    vi.stubGlobal("fetch", fetchMock);
    const result = (
      await mcpBody(await createHandler()(mcpRequest("tools/call", { name: "get_pub", arguments: { id } })))
    ).result as Record<string, unknown>;
    expect(result).toMatchObject({ isError: true });
    expect(JSON.stringify(result)).toContain(errorCode);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("keeps the tool allow list and Automation OpenAPI path aligned", () => {
    const openapi = readFileSync(resolve(import.meta.dirname, "../../docs/specs/openapi/openapi.yaml"), "utf8");
    const mappings = [
      ["automation-master.yaml", "Prefectures", "master/prefectures", "master:read"],
      ["automation-master.yaml", "Municipalities", "master/municipalities", "master:read"],
      ["automation-master.yaml", "Tags", "master/tags", "master:read"],
      ["automation-master.yaml", "Statuses", "master/statuses", "master:read"],
      ["automation-content.yaml", "Collection", "content", "content:read"],
      ["automation-content.yaml", "Item", "content/{id}", "content:read"],
      ["automation-quiz.yaml", "Collection", "quiz", "quiz:read"],
      ["automation-quiz.yaml", "Item", "quiz/{id}", "quiz:read"],
      ["automation-pubs.yaml", "Collection", "pubs", "pubs:read"],
      ["automation-pubs.yaml", "Item", "pubs/{id}", "pubs:read"],
    ];
    for (const [file, section, path, scope] of mappings) {
      const operations = readFileSync(resolve(import.meta.dirname, `../../docs/specs/openapi/paths/${file}`), "utf8");
      expect(openapi).toContain(`/api/automation/v1/${path}:`);
      expect(operations).toMatch(new RegExp(`^${section}:[\\s\\S]*?  get:[\\s\\S]*?x-required-scope: ${scope}`, "m"));
    }
    expect(MCP_TOOL_ALLOW_LIST).toEqual([
      "list_prefectures",
      "list_municipalities",
      "list_tags",
      "list_pub_statuses",
      "list_content",
      "get_content",
      "list_quizzes",
      "get_quiz",
      "list_pubs",
      "get_pub",
    ]);
  });
});
