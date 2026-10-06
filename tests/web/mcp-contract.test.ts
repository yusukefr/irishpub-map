// @vitest-environment node
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getProtectedResource } from "../../apps/web/app/.well-known/oauth-protected-resource/route";
import { verifyMcpAccessToken, type McpOAuthConfig } from "../../apps/web/app/lib/mcp-auth";
import { createAuthenticatedMcpHandler } from "../../apps/web/app/lib/mcp-server";
import { MCP_TOOL_ALLOW_LIST } from "../../apps/web/app/lib/mcp-tools";
import { quizListResponse, quizResponse } from "../../apps/web/app/lib/mcp-read-schemas";
import { quizPublicationResponse } from "../../apps/web/app/lib/mcp-write-schemas";

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
  id: "11111111-1111-4111-8111-000000000006",
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
const pubWrite = Object.fromEntries(
  Object.entries(pubBase).filter(([key]) => !["id", "isPublished", "updatedAt"].includes(key)),
);
const pubDetail = { pub: pubBase };
const tagWrite = { key: "live-music", translations: { ja: "ライブ音楽", en: "Live music" } };
const tagDetail = { tag: { id, ...tagWrite, pubCount: 0 } };
const contentWrite = {
  kind: "story",
  slug: "sample",
  category: "history",
  heroImageAssetId: null,
  translations: {
    ja: { title: "記事", summary: "概要", bodyMarkdown: "本文", heroImageAlt: "", heroImageCaption: "" },
    en: { title: "Story", summary: "Summary", bodyMarkdown: "Body", heroImageAlt: "", heroImageCaption: "" },
  },
};
const contentDetail = { content: { ...contentBase, ...contentWrite, heroImage: null } };
const quizWrite = {
  category: null,
  specialDate: null,
  correctChoiceId: null,
  sourceUrl: null,
  relatedContentId: null,
  imageAssetId: null,
  translations: {
    ja: { question: "質問", explanation: "説明", sourceLabel: "出典", imageAlt: "", imageCaption: "" },
    en: { question: "Question", explanation: "Explanation", sourceLabel: "Source", imageAlt: "", imageCaption: "" },
  },
  choices: [{ id: "first", translations: { ja: "一", en: "One" } }],
};
const quizDetail = {
  question: {
    ...quizBase,
    ...quizWrite,
    image: null,
    choices: [{ ...quizWrite.choices[0], sortOrder: 0 }],
  },
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

  it("serves 2026-07-28 discovery, the reviewed tools, and an Automation API call", async () => {
    const handler = createHandler();
    const discovered = await handler(mcpRequest("server/discover"));
    expect(discovered.status).toBe(200);
    expect(JSON.stringify((await mcpBody(discovered)).result)).toContain(MODERN_PROTOCOL_VERSION);

    const listed = await handler(mcpRequest("tools/list"));
    expect(listed.status).toBe(200);
    const listResult = (await mcpBody(listed)).result as { tools: Array<Record<string, unknown>> };
    expect(listResult.tools.map((tool) => tool.name)).toEqual([...MCP_TOOL_ALLOW_LIST]);
    expect(new Set(listResult.tools.map((tool) => tool.name)).size).toBe(listResult.tools.length);
    expect(listResult.tools).toHaveLength(20);
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
    for (const [index, tool] of listResult.tools.slice(0, 10).entries()) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
      expect(tool.description).toContain(scopes[index]);
      expect(tool.description).toContain("Read-only");
    }
    const writeScopes = [
      "content:create",
      "content:update",
      "content:publish",
      "quiz:create",
      "quiz:update",
      "quiz:publish",
      "pubs:create",
      "pubs:update",
      "pubs:publish",
      "tag:create",
    ];
    for (const [index, tool] of listResult.tools.slice(10).entries()) {
      const create = [0, 3, 6, 9].includes(index);
      expect(tool.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: !create,
        idempotentHint: !create,
        openWorldHint: false,
      });
      expect(tool.description).toContain(writeScopes[index]);
      expect(tool.description).toContain(create ? "list_" : "get_");
      expect(tool.description).toContain(create ? "idempotencyKey" : "explicit user confirmation");
      expect(tool.description).toContain("after");
      expect(tool.description).toContain("delete");
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
    const initializedResult = (await mcpBody(initialized)).result;
    expect(initializedResult).toMatchObject({ protocolVersion: LEGACY_PROTOCOL_VERSION });
    const instructions = JSON.stringify(initializedResult);
    expect(instructions).toContain("explicit user confirmation");
    expect(instructions).toContain("After every write");
    expect(instructions).toContain("same key and payload");
  });

  it("rejects insufficient MCP scope before an Automation API call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await createHandler([])(mcpRequest("tools/call", { name: "list_prefectures", arguments: {} }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks a signed OAuth JWT through the MCP handler before calling Automation API", async () => {
    const { publicKey, privateKey } = await generateKeyPair("RS256");
    const keySet = createLocalJWKSet({
      keys: [{ ...(await exportJWK(publicKey)), kid: "integration-key", alg: "RS256" }],
    });
    const config: McpOAuthConfig = {
      publicOrigin: process.env.MCP_PUBLIC_ORIGIN!,
      issuer: process.env.MCP_OAUTH_ISSUER!,
      audience: process.env.MCP_OAUTH_AUDIENCE!,
      jwksUrl: process.env.MCP_OAUTH_JWKS_URL!,
      allowedSubject: process.env.MCP_OAUTH_ALLOWED_SUBJECT!,
    };
    const now = Math.floor(Date.now() / 1000);
    const token = (subject: string, scope: string, issuedAt = now) =>
      new SignJWT({ scope, client_id: "integration-client" })
        .setProtectedHeader({ alg: "RS256", kid: "integration-key" })
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setSubject(subject)
        .setIssuedAt(issuedAt)
        .setExpirationTime(now + 600)
        .sign(privateKey);
    const handler = createAuthenticatedMcpHandler(async (_request, bearer) =>
      bearer ? verifyMcpAccessToken(bearer, config, keySet) : undefined,
    );
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ prefectures: [] }));
    vi.stubGlobal("fetch", fetchMock);

    for (const denied of [
      await token("other-subject", "mcp:read"),
      await token(config.allowedSubject, "mcp:read", now + 300),
    ]) {
      expect((await handler(mcpRequest("server/discover", undefined, denied))).status).toBe(401);
    }
    const missingScope = await token(config.allowedSubject, "other:scope");
    expect((await handler(mcpRequest("tools/list", undefined, missingScope))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();

    const accepted = await token(config.allowedSubject, "mcp:read");
    expect((await handler(mcpRequest("server/discover", undefined, accepted))).status).toBe(200);
    const called = await handler(mcpRequest("tools/call", { name: "list_prefectures", arguments: {} }, accepted));
    expect(called.status).toBe(200);
    const result = (await mcpBody(called)).result as Record<string, unknown>;
    expect(result.structuredContent).toEqual({ prefectures: [] });
    expect(JSON.stringify(result)).not.toContain(accepted);
    expect(JSON.stringify(result)).not.toContain(config.allowedSubject);
    expect(fetchMock).toHaveBeenCalledOnce();
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
        args: { id: "11111111-1111-4111-8111-000000000006" },
        path: "/quiz/11111111-1111-4111-8111-000000000006",
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

  it("rejects duplicate pub tag IDs in an Automation API response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ pub: { ...pubBase, tagIds: [id, id] } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await createHandler()(mcpRequest("tools/call", { name: "get_pub", arguments: { id } }));
    const result = (await mcpBody(response)).result as Record<string, unknown>;

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(result.content).toEqual([
      { type: "text", text: JSON.stringify({ source: "automation_api", status: 502, errorCode: "invalid_response" }) },
    ]);
    expect(JSON.stringify(result)).not.toContain(process.env.MCP_AUTOMATION_API_TOKEN);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("maps Pub and Tag writes to reviewed endpoints and keeps server-managed fields out of bodies", async () => {
    const cases = [
      {
        name: "create_pub",
        args: { idempotencyKey: "pub-intent-1", ...pubWrite },
        method: "POST",
        path: "/pubs",
        body: pubWrite,
        response: pubDetail,
        key: "pub-intent-1",
      },
      {
        name: "update_pub",
        args: { id, ...pubWrite },
        method: "PUT",
        path: `/pubs/${id}`,
        body: pubWrite,
        response: pubDetail,
      },
      ...[true, false].map((isPublished) => ({
        name: "set_pub_publication",
        args: { id, isPublished },
        method: "PATCH",
        path: `/pubs/${id}/publication`,
        body: { isPublished },
        response: { publication: { id, isPublished, unchanged: false } },
      })),
      {
        name: "create_tag",
        args: { idempotencyKey: "tag-intent-1", ...tagWrite },
        method: "POST",
        path: "/tags",
        body: tagWrite,
        response: tagDetail,
        key: "tag-intent-1",
      },
    ];
    const handler = createHandler();
    for (const item of cases) {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          Response.json(item.response, { status: item.method === "POST" ? 201 : 200, headers: { "X-Request-Id": id } }),
        );
      vi.stubGlobal("fetch", fetchMock);
      const result = (await mcpBody(await handler(mcpRequest("tools/call", { name: item.name, arguments: item.args }))))
        .result as Record<string, unknown>;
      const expected = { ...item.response, requestId: id };
      expect(result.structuredContent, item.name).toEqual(expected);
      expect(JSON.parse((result.content as Array<{ text: string }>)[0].text), item.name).toEqual(expected);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
      const headers = init.headers as Headers;
      expect(url.pathname, item.name).toBe(`/api/automation/v1${item.path}`);
      expect(init.method, item.name).toBe(item.method);
      expect(JSON.parse(String(init.body)), item.name).toEqual(item.body);
      expect(headers.get("Idempotency-Key"), item.name).toBe(item.key ?? null);
      expect(JSON.stringify(result)).not.toContain(process.env.MCP_AUTOMATION_API_TOKEN);
    }
  });

  it("rejects Pub and Tag server-managed inputs and invalid write responses", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const handler = createHandler();
    for (const [name, args] of [
      ["create_pub", { idempotencyKey: "intent", ...pubWrite, isPublished: true }],
      ["update_pub", { id, ...pubWrite, updatedAt: timestamp }],
      ["update_pub", { id, ...pubWrite, status: 1 }],
      [
        "create_pub",
        {
          idempotencyKey: "intent",
          ...pubWrite,
          translations: { ja: { name: "", nameReading: null, address: null }, en: null },
        },
      ],
      [
        "update_pub",
        { id, ...pubWrite, translations: { ja: { name: "   ", nameReading: null, address: null }, en: null } },
      ],
      [
        "create_pub",
        {
          idempotencyKey: "intent",
          ...pubWrite,
          translations: { ja: pubBase.translations.ja, en: { name: "Pub", nameReading: null, address: null } },
        },
      ],
      [
        "update_pub",
        {
          id,
          ...pubWrite,
          translations: { ja: pubBase.translations.ja, en: { name: "Pub", nameReading: null, address: "   " } },
        },
      ],
      ["create_tag", { idempotencyKey: "intent", ...tagWrite, pubCount: 0 }],
      ["create_tag", { idempotencyKey: "intent", key: "Invalid Key", translations: { ja: "タグ" } }],
      ["create_tag", { idempotencyKey: "intent", key: "food", translations: { ja: "" } }],
      ["create_tag", { idempotencyKey: "intent", key: "food", translations: { ja: "   " } }],
      ["set_pub_publication", { id, status: "published" }],
    ] as const) {
      const result = (await mcpBody(await handler(mcpRequest("tools/call", { name, arguments: args }))))
        .result as Record<string, unknown>;
      expect(result.isError, name).toBe(true);
    }
    expect(fetchMock).not.toHaveBeenCalled();

    for (const [name, args, body] of [
      ["create_pub", { idempotencyKey: "intent", ...pubWrite }, { pub: { ...pubBase, isPublished: true } }],
      ["create_tag", { idempotencyKey: "intent", ...tagWrite }, { tag: { ...tagDetail.tag, id: "invalid" } }],
    ] as const) {
      fetchMock.mockResolvedValueOnce(Response.json(body, { status: 201, headers: { "X-Request-Id": id } }));
      const result = (await mcpBody(await handler(mcpRequest("tools/call", { name, arguments: args }))))
        .result as Record<string, unknown>;
      expect(result.isError, name).toBe(true);
      expect(JSON.stringify(result)).toContain("invalid_response");
    }
  });

  it("accepts a minimal unpublished Pub draft and preserves Create keys on retries", async () => {
    const draftWrite = {
      prefectureCode: null,
      municipalityCode: null,
      latitude: null,
      longitude: null,
      websiteUrl: null,
      googleMapsUrl: null,
      instagramUrl: null,
      status: null,
      translations: { ja: { name: "パブ", nameReading: null, address: null }, en: null },
      tagIds: [],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { pub: { ...draftWrite, id, isPublished: false, updatedAt: timestamp } },
          {
            status: 201,
            headers: { "X-Request-Id": id },
          },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { pub: { ...draftWrite, id, isPublished: false, updatedAt: timestamp } },
          {
            status: 201,
            headers: { "X-Request-Id": id },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const handler = createHandler();
    const args = { idempotencyKey: "same-pub-intent", ...draftWrite };
    for (let index = 0; index < 2; index++) {
      const result = (await mcpBody(await handler(mcpRequest("tools/call", { name: "create_pub", arguments: args }))))
        .result as Record<string, unknown>;
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ pub: { isPublished: false }, requestId: id });
    }
    expect(fetchMock.mock.calls.map(([, init]) => (init.headers as Headers).get("Idempotency-Key"))).toEqual([
      "same-pub-intent",
      "same-pub-intent",
    ]);
    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init.body)))).toEqual([draftWrite, draftWrite]);
  });

  it("preserves Pub and Tag conflict details without a fallback write", async () => {
    const cases = [
      ["create_pub", { idempotencyKey: "pub-1", ...pubWrite }, 409, "validation_error", { tagIds: "invalid_format" }],
      ["create_tag", { idempotencyKey: "tag-1", ...tagWrite }, 409, "tag_conflict", {}],
      ["create_tag", { idempotencyKey: "tag-1", ...tagWrite }, 409, "idempotency_in_progress", {}],
      ["update_pub", { id, ...pubWrite }, 404, "pub_not_found", {}],
      ["set_pub_publication", { id, isPublished: true }, 422, "publication_requirements_not_met", {}],
    ] as const;
    const handler = createHandler();
    for (const [name, args, status, errorCode, fieldErrors] of cases) {
      const fetchMock = vi.fn().mockResolvedValue(
        Response.json(
          {
            errorCode,
            fieldErrors,
            missingFields: ["address"],
            secret: process.env.MCP_AUTOMATION_API_TOKEN,
          },
          { status, headers: { "X-Request-Id": id } },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);
      const result = (await mcpBody(await handler(mcpRequest("tools/call", { name, arguments: args }))))
        .result as Record<string, unknown>;
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toContain(errorCode);
      expect(JSON.stringify(result)).not.toContain(process.env.MCP_AUTOMATION_API_TOKEN);
      expect(fetchMock).toHaveBeenCalledOnce();
    }
  });

  it("maps all six Content and Quiz write tools to reviewed methods and bodies", async () => {
    const cases = [
      {
        name: "create_content",
        args: { idempotencyKey: "content-intent-1", ...contentWrite },
        method: "POST",
        path: "/content",
        body: contentWrite,
        response: contentDetail,
        key: "content-intent-1",
      },
      {
        name: "update_content",
        args: { id, ...contentWrite },
        method: "PUT",
        path: `/content/${id}`,
        body: contentWrite,
        response: contentDetail,
      },
      {
        name: "set_content_publication",
        args: { id, status: "published" },
        method: "PATCH",
        path: `/content/${id}/publication`,
        body: { status: "published" },
        response: { publication: { id, status: "published", unchanged: false, publishedAt: timestamp } },
      },
      {
        name: "set_content_publication",
        args: { id, status: "draft" },
        method: "PATCH",
        path: `/content/${id}/publication`,
        body: { status: "draft" },
        response: { publication: { id, status: "draft", unchanged: false, publishedAt: null } },
      },
      {
        name: "create_quiz",
        args: { idempotencyKey: "quiz-intent-1", ...quizWrite },
        method: "POST",
        path: "/quiz",
        body: quizWrite,
        response: quizDetail,
        key: "quiz-intent-1",
      },
      {
        name: "update_quiz",
        args: { id: "11111111-1111-4111-8111-000000000006", ...quizWrite },
        method: "PUT",
        path: "/quiz/11111111-1111-4111-8111-000000000006",
        body: quizWrite,
        response: quizDetail,
      },
      {
        name: "set_quiz_publication",
        args: { id: "11111111-1111-4111-8111-000000000006", isPublished: true },
        method: "PATCH",
        path: "/quiz/11111111-1111-4111-8111-000000000006/publication",
        body: { isPublished: true },
        response: { publication: { id: "11111111-1111-4111-8111-000000000006", isPublished: true, unchanged: false } },
      },
      {
        name: "set_quiz_publication",
        args: { id: "11111111-1111-4111-8111-000000000006", isPublished: false },
        method: "PATCH",
        path: "/quiz/11111111-1111-4111-8111-000000000006/publication",
        body: { isPublished: false },
        response: { publication: { id: "11111111-1111-4111-8111-000000000006", isPublished: false, unchanged: false } },
      },
    ];
    const handler = createHandler();
    for (const item of cases) {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          Response.json(item.response, { status: item.method === "POST" ? 201 : 200, headers: { "X-Request-Id": id } }),
        );
      vi.stubGlobal("fetch", fetchMock);
      const response = await handler(mcpRequest("tools/call", { name: item.name, arguments: item.args }));
      const result = (await mcpBody(response)).result as Record<string, unknown>;
      const expected = { ...item.response, requestId: id };
      expect(result.isError, item.name).not.toBe(true);
      expect(result.structuredContent, item.name).toEqual(expected);
      expect(JSON.parse((result.content as Array<{ text: string }>)[0].text), item.name).toEqual(expected);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
      const headers = init.headers as Headers;
      expect(url.pathname, item.name).toBe(`/api/automation/v1${item.path}`);
      expect(init.method, item.name).toBe(item.method);
      expect(JSON.parse(String(init.body)), item.name).toEqual(item.body);
      expect(headers.get("Idempotency-Key"), item.name).toBe(item.key ?? null);
      expect(headers.get("Content-Type"), item.name).toBe("application/json");
      expect(JSON.stringify(result)).not.toContain(process.env.MCP_AUTOMATION_API_TOKEN);
    }
  });

  it("rejects every write success when X-Request-Id is missing or malformed", async () => {
    const cases = [
      ["create_content", { idempotencyKey: "content-1", ...contentWrite }, contentDetail],
      ["update_content", { id, ...contentWrite }, contentDetail],
      [
        "set_content_publication",
        { id, status: "draft" },
        { publication: { id, status: "draft", unchanged: true, publishedAt: null } },
      ],
      ["create_quiz", { idempotencyKey: "quiz-1", ...quizWrite }, quizDetail],
      ["update_quiz", { id: "11111111-1111-4111-8111-000000000006", ...quizWrite }, quizDetail],
      [
        "set_quiz_publication",
        { id: "11111111-1111-4111-8111-000000000006", isPublished: false },
        { publication: { id: "11111111-1111-4111-8111-000000000006", isPublished: false, unchanged: true } },
      ],
      ["create_pub", { idempotencyKey: "pub-1", ...pubWrite }, pubDetail],
      ["update_pub", { id, ...pubWrite }, pubDetail],
      ["set_pub_publication", { id, isPublished: false }, { publication: { id, isPublished: false, unchanged: true } }],
      ["create_tag", { idempotencyKey: "tag-1", ...tagWrite }, tagDetail],
    ] as const;
    const handler = createHandler();
    for (const [name, args, body] of cases) {
      for (const header of [undefined, "-".repeat(36)]) {
        const fetchMock = vi
          .fn()
          .mockResolvedValue(Response.json(body, { headers: header ? { "X-Request-Id": header } : {} }));
        vi.stubGlobal("fetch", fetchMock);
        const result = (await mcpBody(await handler(mcpRequest("tools/call", { name, arguments: args }))))
          .result as Record<string, unknown>;
        expect(result.isError, name).toBe(true);
        expect(result.structuredContent, name).toBeUndefined();
        expect(JSON.parse((result.content as Array<{ text: string }>)[0].text), name).toMatchObject({
          status: 502,
          errorCode: "invalid_response",
        });
        expect(fetchMock, name).toHaveBeenCalledOnce();
      }
    }
  });

  it("rejects create responses that are not drafts", async () => {
    const cases = [
      [
        "create_content",
        { idempotencyKey: "content-1", ...contentWrite },
        { content: { ...contentDetail.content, status: "published", publishedAt: timestamp } },
      ],
      [
        "create_content",
        { idempotencyKey: "content-2", ...contentWrite },
        { content: { ...contentDetail.content, publishedAt: timestamp } },
      ],
      [
        "create_quiz",
        { idempotencyKey: "quiz-1", ...quizWrite },
        { question: { ...quizDetail.question, isPublished: true } },
      ],
    ] as const;
    const handler = createHandler();
    for (const [name, args, body] of cases) {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(Response.json(body, { status: 201, headers: { "X-Request-Id": id } }));
      vi.stubGlobal("fetch", fetchMock);
      const result = (await mcpBody(await handler(mcpRequest("tools/call", { name, arguments: args }))))
        .result as Record<string, unknown>;
      expect(result.isError, name).toBe(true);
      expect(result.structuredContent, name).toBeUndefined();
      expect(JSON.stringify(result), name).toContain("invalid_response");
      expect(fetchMock, name).toHaveBeenCalledOnce();
    }
  });

  it("accepts an incomplete quiz draft and rejects server-managed fields before a write", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ question: { ...quizDetail.question, choices: [] } }, { headers: { "X-Request-Id": id } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const handler = createHandler();
    const draft = (
      await mcpBody(
        await handler(
          mcpRequest("tools/call", {
            name: "create_quiz",
            arguments: { idempotencyKey: "draft-1", choices: [] },
          }),
        ),
      )
    ).result as Record<string, unknown>;
    expect(draft.isError).not.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ choices: [] });

    for (const [name, args] of [
      ["create_content", { idempotencyKey: "bad", ...contentWrite, status: "published" }],
      ["update_content", { id, ...contentWrite, publishedAt: timestamp }],
      ["create_quiz", { idempotencyKey: "bad", ...quizWrite, isPublished: true }],
      [
        "update_quiz",
        {
          id: "11111111-1111-4111-8111-000000000006",
          ...quizWrite,
          choices: [{ ...quizWrite.choices[0], sortOrder: 0 }],
        },
      ],
      ["set_content_publication", { id, isPublished: true }],
      ["set_quiz_publication", { id: "11111111-1111-4111-8111-000000000006", status: "published" }],
      ["create_content", { idempotencyKey: " leading-space", ...contentWrite }],
      ["create_quiz", { idempotencyKey: "", ...quizWrite }],
    ] as const) {
      const result = (await mcpBody(await handler(mcpRequest("tools/call", { name, arguments: args }))))
        .result as Record<string, unknown>;
      expect(result.isError, name).toBe(true);
    }
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects legacy Question IDs in Quiz tool input and responses", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const handler = createHandler();
    for (const [name, args] of [
      ["get_quiz", { id: "legacy-question" }],
      ["update_quiz", { id: "legacy-question", ...quizWrite }],
      ["set_quiz_publication", { id: "legacy-question", isPublished: true }],
    ] as const) {
      const result = (await mcpBody(await handler(mcpRequest("tools/call", { name, arguments: args }))))
        .result as Record<string, unknown>;
      expect(result.isError, name).toBe(true);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(quizResponse.safeParse({ question: { ...quizDetail.question, id: "legacy-question" } }).success).toBe(false);
    expect(
      quizListResponse.safeParse({
        questions: [{ ...quizBase, id: "legacy-question", questionJa: "", questionEn: "", choiceCount: 0 }],
      }).success,
    ).toBe(false);
    expect(
      quizPublicationResponse.safeParse({ publication: { id: "legacy-question", isPublished: true, unchanged: false } })
        .success,
    ).toBe(false);
  });

  it("keeps a create key across an identical retry and preserves conflict and publication errors", async () => {
    const handler = createHandler();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json(contentDetail, { status: 201, headers: { "X-Request-Id": id } }))
      .mockResolvedValueOnce(Response.json(contentDetail, { status: 201, headers: { "X-Request-Id": id } }))
      .mockResolvedValueOnce(Response.json({ errorCode: "idempotency_conflict" }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({ errorCode: "idempotency_in_progress" }, { status: 409 }))
      .mockResolvedValueOnce(
        Response.json(
          {
            errorCode: "publication_requirements_not_met",
            missingFields: ["en.title"],
            secret: process.env.MCP_AUTOMATION_API_TOKEN,
          },
          { status: 422 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const createArgs = { idempotencyKey: "same-intent", ...contentWrite };
    for (let index = 0; index < 4; index++) {
      const result = (
        await mcpBody(await handler(mcpRequest("tools/call", { name: "create_content", arguments: createArgs })))
      ).result as Record<string, unknown>;
      expect(result.isError).toBe(index > 1 ? true : undefined);
      if (index > 1)
        expect(JSON.stringify(result)).toContain(index === 2 ? "idempotency_conflict" : "idempotency_in_progress");
    }
    const publication = (
      await mcpBody(
        await handler(
          mcpRequest("tools/call", {
            name: "set_content_publication",
            arguments: { id, status: "published" },
          }),
        ),
      )
    ).result as Record<string, unknown>;
    expect(publication.isError).toBe(true);
    expect(JSON.stringify(publication)).toContain("en.title");
    expect(JSON.stringify(publication)).not.toContain(process.env.MCP_AUTOMATION_API_TOKEN);
    expect(
      fetchMock.mock.calls.slice(0, 4).map(([, init]) => (init.headers as Headers).get("Idempotency-Key")),
    ).toEqual(Array(4).fill("same-intent"));
    expect(fetchMock.mock.calls.slice(0, 4).map(([, init]) => init.body)).toEqual(
      Array(4).fill(JSON.stringify(contentWrite)),
    );
  });

  it("reuses the quiz create key and body on a retry", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Response.json(quizDetail, { status: 201, headers: { "X-Request-Id": id } }));
    vi.stubGlobal("fetch", fetchMock);
    const handler = createHandler();
    const args = { idempotencyKey: "quiz-same-intent", ...quizWrite };
    for (let index = 0; index < 2; index++) {
      const result = (await mcpBody(await handler(mcpRequest("tools/call", { name: "create_quiz", arguments: args }))))
        .result as Record<string, unknown>;
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toEqual({ ...quizDetail, requestId: id });
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchMock.mock.calls) {
      expect((init.headers as Headers).get("Idempotency-Key")).toBe("quiz-same-intent");
      expect(JSON.parse(init.body)).toEqual(quizWrite);
    }
  });

  it("supports detail read, confirmed update, and detail read-back without changing publication", async () => {
    const before = {
      content: {
        ...contentDetail.content,
        translations: { ...contentWrite.translations, ja: { ...contentWrite.translations.ja, title: "変更前" } },
      },
    };
    const after = contentDetail;
    let saved = before;
    const fetchMock = vi.fn().mockImplementation((_url: URL, init: RequestInit) => {
      if (init.method === "GET") return Response.json(saved);
      saved = after;
      return Response.json(after, { headers: { "X-Request-Id": id } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const handler = createHandler();
    const readBefore = (
      await mcpBody(await handler(mcpRequest("tools/call", { name: "get_content", arguments: { id } })))
    ).result as Record<string, unknown>;
    expect(readBefore.structuredContent).toEqual(before);
    // 実運用では差分提示と明示的なユーザー確認を、この呼び出しの前にClientが行う。
    const updated = (
      await mcpBody(
        await handler(mcpRequest("tools/call", { name: "update_content", arguments: { id, ...contentWrite } })),
      )
    ).result as Record<string, unknown>;
    expect(updated.structuredContent).toEqual({ ...after, requestId: id });
    const readBack = (
      await mcpBody(await handler(mcpRequest("tools/call", { name: "get_content", arguments: { id } })))
    ).result as Record<string, unknown>;
    expect(readBack.structuredContent).toEqual(after);
    expect(after.content.status).toBe(before.content.status);
    expect(fetchMock.mock.calls.map(([, init]) => init.method)).toEqual(["GET", "PUT", "GET"]);
  });

  it("fails closed on invalid write responses and preserves API errors without a fallback write", async () => {
    const handler = createHandler();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ content: { id, status: "draft" } }, { status: 201, headers: { "X-Request-Id": id } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const invalid = (
      await mcpBody(
        await handler(
          mcpRequest("tools/call", {
            name: "create_content",
            arguments: { idempotencyKey: "intent-1", ...contentWrite },
          }),
        ),
      )
    ).result as Record<string, unknown>;
    expect(invalid.isError).toBe(true);
    expect(invalid.structuredContent).toBeUndefined();
    expect(JSON.stringify(invalid)).toContain("invalid_response");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    [400, "invalid_request"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "content_not_found"],
    [409, "content_conflict"],
    [415, "invalid_content_type"],
    [422, "validation_error"],
    [503, "database_unavailable"],
    [500, "internal_error"],
  ])("preserves safe write errors for HTTP %i", async (status, errorCode) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { errorCode, fieldErrors: { slug: "invalid_format" }, secret: process.env.MCP_AUTOMATION_API_TOKEN },
          { status, headers: { "X-Request-Id": id } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = (
      await mcpBody(
        await createHandler()(
          mcpRequest("tools/call", {
            name: "update_content",
            arguments: { id, ...contentWrite },
          }),
        ),
      )
    ).result as Record<string, unknown>;
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    expect(JSON.stringify(result)).toContain(errorCode);
    expect(JSON.stringify(result)).toContain(id);
    expect(JSON.stringify(result)).not.toContain(process.env.MCP_AUTOMATION_API_TOKEN);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
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
      "create_content",
      "update_content",
      "set_content_publication",
      "create_quiz",
      "update_quiz",
      "set_quiz_publication",
      "create_pub",
      "update_pub",
      "set_pub_publication",
      "create_tag",
    ]);
    for (const [file, section, path, method, scope] of [
      ["automation-content.yaml", "Collection", "content", "post", "content:create"],
      ["automation-content.yaml", "Item", "content/{id}", "put", "content:update"],
      ["automation-content.yaml", "Publication", "content/{id}/publication", "patch", "content:publish"],
      ["automation-quiz.yaml", "Collection", "quiz", "post", "quiz:create"],
      ["automation-quiz.yaml", "Item", "quiz/{id}", "put", "quiz:update"],
      ["automation-quiz.yaml", "Publication", "quiz/{id}/publication", "patch", "quiz:publish"],
      ["automation-pubs.yaml", "Collection", "pubs", "post", "pubs:create"],
      ["automation-pubs.yaml", "Item", "pubs/{id}", "put", "pubs:update"],
      ["automation-pubs.yaml", "Publication", "pubs/{id}/publication", "patch", "pubs:publish"],
      ["automation-master.yaml", "TagCollection", "tags", "post", "tag:create"],
    ]) {
      const operations = readFileSync(resolve(import.meta.dirname, `../../docs/specs/openapi/paths/${file}`), "utf8");
      expect(openapi).toContain(`/api/automation/v1/${path}:`);
      expect(operations).toMatch(
        new RegExp(`^${section}:[\\s\\S]*?  ${method}:[\\s\\S]*?x-required-scope: ${scope}`, "m"),
      );
    }
  });
});
