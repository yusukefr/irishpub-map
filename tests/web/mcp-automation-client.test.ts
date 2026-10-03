// @vitest-environment node
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseAutomationApiError, requestAutomationApi } from "../../apps/web/app/lib/mcp-automation-client";

const previousOrigin = process.env.MCP_AUTOMATION_API_ORIGIN;
const previousToken = process.env.MCP_AUTOMATION_API_TOKEN;
const previousBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

beforeEach(() => {
  process.env.MCP_AUTOMATION_API_ORIGIN = "https://example.test";
  process.env.MCP_AUTOMATION_API_TOKEN = randomBytes(32).toString("hex");
  delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (previousOrigin === undefined) delete process.env.MCP_AUTOMATION_API_ORIGIN;
  else process.env.MCP_AUTOMATION_API_ORIGIN = previousOrigin;
  if (previousToken === undefined) delete process.env.MCP_AUTOMATION_API_TOKEN;
  else process.env.MCP_AUTOMATION_API_TOKEN = previousToken;
  if (previousBypass === undefined) delete process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  else process.env.VERCEL_AUTOMATION_BYPASS_SECRET = previousBypass;
});

describe("MCP Automation API client", () => {
  it("calls the allowlisted Automation path with a server-side Bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ prefectures: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestAutomationApi({ method: "GET", path: "/api/automation/v1/master/prefectures" });

    expect(result).toMatchObject({ ok: true, status: 200, data: { prefectures: [] } });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/automation/v1/master/prefectures");
    expect((options.headers as Headers).get("Authorization")).toBe(`Bearer ${process.env.MCP_AUTOMATION_API_TOKEN}`);
    expect(JSON.stringify(result)).not.toContain(process.env.MCP_AUTOMATION_API_TOKEN);
  });

  it("encodes GET query values without changing the allowlisted path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ pubs: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await requestAutomationApi({
      method: "GET",
      path: "/api/automation/v1/pubs",
      query: { name: "Irish & Music", page: "2" },
    });
    const [url, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/api/automation/v1/pubs");
    expect(url.searchParams.get("name")).toBe("Irish & Music");
    expect(url.searchParams.get("page")).toBe("2");
    expect(options.method).toBe("GET");
  });

  it("can pass an Idempotency-Key without exposing it in results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ created: true }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestAutomationApi({
      method: "POST",
      path: "/api/automation/v1/content",
      idempotencyKey: "logical-operation",
      body: { kind: "guide" },
    });
    const [, options] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect((options.headers as Headers).get("Idempotency-Key")).toBe("logical-operation");
    expect(result.ok).toBe(true);
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [409, "content_conflict"],
    [422, "validation_error"],
    [422, "publication_requirements_not_met"],
  ])("preserves a safe %i %s error", async (status, errorCode) => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          errorCode,
          fieldErrors: { title: "required" },
          missingFields: ["translations.ja.title"],
          extra: process.env.MCP_AUTOMATION_API_TOKEN,
        },
        { status },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await requestAutomationApi({ method: "GET", path: "/api/automation/v1/master/prefectures" });
    expect(result).toMatchObject({ ok: false, status, error: { errorCode } });
    expect(JSON.stringify(result)).not.toContain(process.env.MCP_AUTOMATION_API_TOKEN);
  });

  it("rejects non-Automation paths and unknown error fields", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await requestAutomationApi({ method: "GET", path: "/api/admin/calendar" })).toMatchObject({
      ok: false,
      error: { errorCode: "mcp_invalid_path" },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(parseAutomationApiError({ errorCode: "unknown", fieldErrors: { title: "unknown" } })).toEqual({
      errorCode: "invalid_response",
    });
  });
});
