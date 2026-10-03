import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { requestAutomationApi, type AutomationApiResult } from "./mcp-automation-client";
import {
  contentListResponse,
  contentResponse,
  municipalitiesResponse,
  prefecturesResponse,
  pubListResponse,
  pubResponse,
  quizListResponse,
  quizResponse,
  statusesResponse,
  tagsResponse,
} from "./mcp-read-schemas";

/** #510 で審査した Read-only Tool 名です。新しい Endpoint は自動公開しません。 */
export const MCP_TOOL_ALLOW_LIST = [
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
] as const;

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;
const emptyInput = z.object({}).strict();
const uuidId = z.object({ id: z.uuid() }).strict();
const quizId = z
  .object({
    id: z
      .string()
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict();
const pubFilters = z
  .object({
    name: z.string().max(100).optional(),
    prefecture: z.number().int().min(1).max(47).optional(),
    municipality: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    status: z.enum(["open", "temporarily_closed", "closed", "unknown"]).optional(),
    tag: z.uuid().optional(),
    published: z.boolean().optional(),
    page: z.number().int().min(1).max(100_000).optional(),
  })
  .strict();

function errorResult(result: Extract<AutomationApiResult, { ok: false }>) {
  const detail = {
    source: result.error.errorCode.startsWith("mcp_") ? "mcp_server" : "automation_api",
    status: result.status,
    ...result.error,
    ...(result.requestId ? { requestId: result.requestId } : {}),
  };
  return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(detail) }] };
}

async function readResult(path: string, schema: z.ZodType, query?: Record<string, string>) {
  const result = await requestAutomationApi({ method: "GET", path, query });
  if (!result.ok) return errorResult(result);
  const parsed = schema.safeParse(result.data);
  if (!parsed.success) {
    return errorResult({
      ok: false,
      status: 502,
      error: { errorCode: "invalid_response" },
      requestId: result.requestId,
    });
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify(parsed.data) }],
    structuredContent: parsed.data,
  };
}

function description(target: string, scope: string, purpose: string): string {
  return `Read-only. Returns current ${target} through the Automation API for ${purpose}. Requires the server-side ${scope} scope. Does not create, update, publish, or delete data.`;
}

/**
 * 安全性を審査した Tool だけを MCP SDK へ登録します。
 * @param server - Request ごとに生成される MCP Server。
 * @returns なし。
 */
export function registerMcpTools(server: McpServer): void {
  server.registerTool(
    MCP_TOOL_ALLOW_LIST[0],
    {
      title: "List prefectures",
      description:
        "Read-only. Returns current Irish Pub Map prefectures through the Automation API. Requires the server-side master:read scope. Does not create, update, publish, or delete data.",
      inputSchema: emptyInput,
      outputSchema: prefecturesResponse,
      annotations: readOnlyAnnotations,
    },
    async () => readResult("/api/automation/v1/master/prefectures", prefecturesResponse),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[1],
    {
      title: "List municipalities",
      description: description("municipalities in a prefecture", "master:read", "choosing a pub location"),
      inputSchema: z.object({ prefectureCode: z.number().int().min(1).max(47) }).strict(),
      outputSchema: municipalitiesResponse,
      annotations: readOnlyAnnotations,
    },
    async ({ prefectureCode }) =>
      readResult("/api/automation/v1/master/municipalities", municipalitiesResponse, {
        prefectureCode: String(prefectureCode),
      }),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[2],
    {
      title: "List tags",
      description: description("tags, translations, IDs, and pub counts", "master:read", "checking existing tags"),
      inputSchema: emptyInput,
      outputSchema: tagsResponse,
      annotations: readOnlyAnnotations,
    },
    async () => readResult("/api/automation/v1/master/tags", tagsResponse),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[3],
    {
      title: "List pub statuses",
      description: description("pub status codes and keys", "master:read", "checking available statuses"),
      inputSchema: emptyInput,
      outputSchema: statusesResponse,
      annotations: readOnlyAnnotations,
    },
    async () => readResult("/api/automation/v1/master/statuses", statusesResponse),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[4],
    {
      title: "List content",
      description: description("content drafts and published items", "content:read", "finding existing content"),
      inputSchema: emptyInput,
      outputSchema: contentListResponse,
      annotations: readOnlyAnnotations,
    },
    async () => readResult("/api/automation/v1/content", contentListResponse),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[5],
    {
      title: "Get content",
      description: description("a content item's details", "content:read", "checking its current values"),
      inputSchema: uuidId,
      outputSchema: contentResponse,
      annotations: readOnlyAnnotations,
    },
    async ({ id }) => readResult(`/api/automation/v1/content/${id}`, contentResponse),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[6],
    {
      title: "List quizzes",
      description: description("quiz drafts and published questions", "quiz:read", "finding existing quizzes"),
      inputSchema: emptyInput,
      outputSchema: quizListResponse,
      annotations: readOnlyAnnotations,
    },
    async () => readResult("/api/automation/v1/quiz", quizListResponse),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[7],
    {
      title: "Get quiz",
      description: description("a quiz question and its choices", "quiz:read", "checking its current values"),
      inputSchema: quizId,
      outputSchema: quizResponse,
      annotations: readOnlyAnnotations,
    },
    async ({ id }) => readResult(`/api/automation/v1/quiz/${id}`, quizResponse),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[8],
    {
      title: "List pubs",
      description: description("filtered pubs with page metadata", "pubs:read", "finding existing pubs and duplicates"),
      inputSchema: pubFilters,
      outputSchema: pubListResponse,
      annotations: readOnlyAnnotations,
    },
    async (filters) =>
      readResult(
        "/api/automation/v1/pubs",
        pubListResponse,
        Object.fromEntries(
          Object.entries(filters)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)]),
        ),
      ),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[9],
    {
      title: "Get pub",
      description: description(
        "a pub's details, tags, and publication state",
        "pubs:read",
        "checking its current values",
      ),
      inputSchema: uuidId,
      outputSchema: pubResponse,
      annotations: readOnlyAnnotations,
    },
    async ({ id }) => readResult(`/api/automation/v1/pubs/${id}`, pubResponse),
  );
}
