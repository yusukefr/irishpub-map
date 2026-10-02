import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { requestAutomationApi, type AutomationApiResult } from "./mcp-automation-client";

const prefecturesResponse = z
  .object({
    prefectures: z.array(z.object({ code: z.number().int().min(1).max(47), name: z.string() }).strict()),
  })
  .strict();

/** #509 で公開を審査済みの Tool 名です。追加は個別 Issue で明示的に行います。 */
export const MCP_TOOL_ALLOW_LIST = ["list_prefectures"] as const;

function errorResult(result: Extract<AutomationApiResult, { ok: false }>) {
  const detail = {
    source: result.error.errorCode.startsWith("mcp_") ? "mcp_server" : "automation_api",
    status: result.status,
    ...result.error,
    ...(result.requestId ? { requestId: result.requestId } : {}),
  };
  return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(detail) }] };
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
      inputSchema: z.object({}).strict(),
      outputSchema: prefecturesResponse,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const result = await requestAutomationApi({ method: "GET", path: "/api/automation/v1/master/prefectures" });
      if (!result.ok) return errorResult(result);
      const parsed = prefecturesResponse.safeParse(result.data);
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
    },
  );
}
