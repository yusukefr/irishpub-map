import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { requestAutomationApi, type AutomationApiRequest, type AutomationApiResult } from "./mcp-automation-client";
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
import {
  contentCreateResponse,
  contentPublicationInput,
  contentPublicationResponse,
  contentWrite,
  idempotencyKey,
  pubCreateResponse,
  pubPublicationInput,
  pubPublicationResponse,
  pubWrite,
  quizCreateResponse,
  quizPublicationInput,
  quizPublicationResponse,
  quizWrite,
  tagResponse,
  tagWrite,
} from "./mcp-write-schemas";

/** 審査済みの MCP Tool 名です。新しい Endpoint は自動公開しません。 */
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
] as const;

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;
const createAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;
const mutationAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;
// Automation API の成功本文に含まれない監査用 Header を MCP 結果へ添える。
const contentCreateToolResponse = contentCreateResponse.extend({ requestId: z.uuid() });
const contentWriteResponse = contentResponse.extend({ requestId: z.uuid() });
const quizCreateToolResponse = quizCreateResponse.extend({ requestId: z.uuid() });
const quizWriteResponse = quizResponse.extend({ requestId: z.uuid() });
const contentPublicationWriteResponse = contentPublicationResponse.extend({ requestId: z.uuid() });
const quizPublicationWriteResponse = quizPublicationResponse.extend({ requestId: z.uuid() });
const pubCreateToolResponse = pubCreateResponse.extend({ requestId: z.uuid() });
const pubWriteResponse = pubResponse.extend({ requestId: z.uuid() });
const pubPublicationWriteResponse = pubPublicationResponse.extend({ requestId: z.uuid() });
const tagCreateToolResponse = tagResponse.extend({ requestId: z.uuid() });
const emptyInput = z.object({}).strict();
const uuidId = z.object({ id: z.uuid() }).strict();
const quizId = uuidId;
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

async function automationResult(options: AutomationApiRequest, schema: z.ZodType) {
  const result = await requestAutomationApi(options);
  if (!result.ok) return errorResult(result);
  const requestId = z.uuid().safeParse(result.requestId);
  const parsed = schema.safeParse(result.data);
  if (!parsed.success) {
    return errorResult({
      ok: false,
      status: 502,
      error: { errorCode: "invalid_response" },
      requestId: requestId.success ? requestId.data : undefined,
    });
  }
  if (options.method === "GET") {
    return { content: [{ type: "text" as const, text: JSON.stringify(parsed.data) }], structuredContent: parsed.data };
  }
  if (!requestId.success || !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
    return errorResult({ ok: false, status: 502, error: { errorCode: "invalid_response" } });
  }
  const data = { ...parsed.data, requestId: requestId.data };
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: data };
}

async function readResult(path: string, schema: z.ZodType, query?: Record<string, string>) {
  return automationResult({ method: "GET", path, query }, schema);
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

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[10],
    {
      title: "Create content draft",
      description:
        "Write operation. Creates a new content draft through the Automation API with content:create scope. Call list_content first to check existing content. Requires idempotencyKey for safe retries: reuse the same key and payload within 24 hours if the result is unknown. Does not publish, update, or delete existing content. Call get_content with the returned ID after creation to verify the saved draft.",
      inputSchema: contentWrite.extend({ idempotencyKey }),
      outputSchema: contentCreateToolResponse,
      annotations: createAnnotations,
    },
    async ({ idempotencyKey: key, ...body }) =>
      automationResult(
        { method: "POST", path: "/api/automation/v1/content", body, idempotencyKey: key },
        contentCreateResponse,
      ),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[11],
    {
      title: "Update content",
      description:
        "Write operation. Replaces all editable fields of existing content through the Automation API with content:update scope. Call get_content first, construct only the five ContentWrite fields, show current values and changes, and obtain explicit user confirmation before calling. Preserves publication state; does not create, publish, or delete. Call get_content again after updating to verify saved values.",
      inputSchema: contentWrite.extend({ id: z.uuid() }),
      outputSchema: contentWriteResponse,
      annotations: mutationAnnotations,
    },
    async ({ id, ...body }) =>
      automationResult({ method: "PUT", path: `/api/automation/v1/content/${id}`, body }, contentResponse),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[12],
    {
      title: "Set content publication",
      description:
        "Write operation. Changes only the publication state of existing content through the Automation API with content:publish scope. Call get_content first, show the current and requested status, and obtain explicit user confirmation before calling. Publishing must satisfy Automation API requirements. Does not create, edit content fields, or delete. Call get_content again after the change to verify publication state.",
      inputSchema: contentPublicationInput.extend({ id: z.uuid() }),
      outputSchema: contentPublicationWriteResponse,
      annotations: mutationAnnotations,
    },
    async ({ id, status }) =>
      automationResult(
        { method: "PATCH", path: `/api/automation/v1/content/${id}/publication`, body: { status } },
        contentPublicationResponse,
      ),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[13],
    {
      title: "Create quiz draft",
      description:
        "Write operation. Creates a new quiz draft through the Automation API with quiz:create scope; incomplete drafts with 0–4 choices are allowed. Call list_quizzes first to check for duplicates. Requires idempotencyKey for safe retries: reuse the same key and payload within 24 hours if the result is unknown. Does not publish, update, or delete existing quizzes. Call get_quiz with the returned ID after creation to verify the saved draft.",
      inputSchema: quizWrite.extend({ idempotencyKey }),
      outputSchema: quizCreateToolResponse,
      annotations: createAnnotations,
    },
    async ({ idempotencyKey: key, ...body }) =>
      automationResult(
        { method: "POST", path: "/api/automation/v1/quiz", body, idempotencyKey: key },
        quizCreateResponse,
      ),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[14],
    {
      title: "Update quiz",
      description:
        "Write operation. Replaces editable fields of an existing quiz through the Automation API with quiz:update scope. Call get_quiz first, construct a QuizWrite snapshot without server-managed fields or choice sortOrder, show current values and changes, and obtain explicit user confirmation before calling. Choice array order determines sortOrder. Preserves publication state; does not create, publish, or delete. Call get_quiz again after updating to verify saved values.",
      inputSchema: quizWrite.extend({ id: quizId.shape.id }),
      outputSchema: quizWriteResponse,
      annotations: mutationAnnotations,
    },
    async ({ id, ...body }) =>
      automationResult({ method: "PUT", path: `/api/automation/v1/quiz/${id}`, body }, quizResponse),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[15],
    {
      title: "Set quiz publication",
      description:
        "Write operation. Changes only the publication state of an existing quiz through the Automation API with quiz:publish scope. Call get_quiz first, show the current and requested isPublished state, and obtain explicit user confirmation before calling. Publishing must satisfy Automation API requirements, including four complete choices. Does not create, edit quiz fields, or delete. Call get_quiz again after the change to verify publication state.",
      inputSchema: quizPublicationInput.extend({ id: quizId.shape.id }),
      outputSchema: quizPublicationWriteResponse,
      annotations: mutationAnnotations,
    },
    async ({ id, isPublished }) =>
      automationResult(
        { method: "PATCH", path: `/api/automation/v1/quiz/${id}/publication`, body: { isPublished } },
        quizPublicationResponse,
      ),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[16],
    {
      title: "Create unpublished pub",
      description:
        "Write operation. Creates an unpublished pub through the Automation API with pubs:create scope. Call list_pubs first and do not create when the same pub exists or duplicates are ambiguous. Read current prefectures, municipalities, statuses, and tags before using their codes, keys, or IDs. A draft requires a Japanese name; other draft fields may be null and tagIds may be empty. Requires idempotencyKey: reuse the same key and payload within 24 hours for an uncertain result. Does not publish, update, or delete. Call get_pub with the returned ID after creation to verify the saved draft.",
      inputSchema: pubWrite.extend({ idempotencyKey }),
      outputSchema: pubCreateToolResponse,
      annotations: createAnnotations,
    },
    async ({ idempotencyKey: key, ...body }) =>
      automationResult(
        { method: "POST", path: "/api/automation/v1/pubs", body, idempotencyKey: key },
        pubCreateResponse,
      ),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[17],
    {
      title: "Update pub",
      description:
        "Write operation. Replaces all editable fields of an existing pub through the Automation API with pubs:update scope. Call get_pub first, show the target and exact before/after changes, and obtain explicit user confirmation. Send only the PubWrite snapshot, never id, isPublished, or updatedAt from GET; refresh master data and tags when relevant. Preserves publication state and does not create or delete. Call get_pub again after updating to verify saved values.",
      inputSchema: pubWrite.extend({ id: z.uuid() }),
      outputSchema: pubWriteResponse,
      annotations: mutationAnnotations,
    },
    async ({ id, ...body }) =>
      automationResult({ method: "PUT", path: `/api/automation/v1/pubs/${id}`, body }, pubResponse),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[18],
    {
      title: "Set pub publication",
      description:
        "Write operation. Changes only an existing pub's isPublished state through the Automation API with pubs:publish scope. Call get_pub first, show the current and requested state, and obtain explicit user confirmation. The Automation API checks publication requirements and reports missingFields. Does not create, edit pub fields, or delete. Call get_pub again after the change to verify publication state.",
      inputSchema: pubPublicationInput.extend({ id: z.uuid() }),
      outputSchema: pubPublicationWriteResponse,
      annotations: mutationAnnotations,
    },
    async ({ id, isPublished }) =>
      automationResult(
        { method: "PATCH", path: `/api/automation/v1/pubs/${id}/publication`, body: { isPublished } },
        pubPublicationResponse,
      ),
  );

  server.registerTool(
    MCP_TOOL_ALLOW_LIST[19],
    {
      title: "Create tag",
      description:
        "Write operation. Creates a reusable tag through the Automation API with tag:create scope. Call list_tags first and compare keys and translations; use an existing tag when it represents the same attribute, and do not create when equivalence is ambiguous. Requires a Japanese translation and idempotencyKey: reuse the same key and payload within 24 hours for an uncertain result. Does not update or delete tags. Call list_tags after creation to verify the new ID and translations.",
      inputSchema: tagWrite.extend({ idempotencyKey }),
      outputSchema: tagCreateToolResponse,
      annotations: createAnnotations,
    },
    async ({ idempotencyKey: key, ...body }) =>
      automationResult({ method: "POST", path: "/api/automation/v1/tags", body, idempotencyKey: key }, tagResponse),
  );
}
