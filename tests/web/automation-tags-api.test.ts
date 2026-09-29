// Automationタグ作成のScope、共有Validation、競合、DB設定と内部エラー一般化を保証します。
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Business Routeの既存契約を確認するテスト。冪等性と監査は専用テストで検証します。
vi.mock("../../apps/web/app/lib/automation-reliability", () => ({
  handleAutomationCreate: (_request: Request, options: { execute: (id: string) => Promise<Response> }) =>
    options.execute("550e8400-e29b-41d4-a716-446655440001"),
}));

const repositoryMocks = vi.hoisted(() => {
  class TagRepositoryError extends Error {
    constructor(readonly code: "conflict") {
      super(code);
    }
  }
  return { TagRepositoryError, createAdminTag: vi.fn() };
});

vi.mock("../../apps/web/app/lib/tag-repository", () => repositoryMocks);

import { POST } from "../../apps/web/app/api/automation/v1/tags/route";

const token = "test-only-automation-token";
const originalHash = process.env.AUTOMATION_API_TOKEN_SHA256;
const originalScopes = process.env.AUTOMATION_API_SCOPES;
const originalDatabaseUrl = process.env.DATABASE_URL;
const tag = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  key: "live-music",
  translations: { ja: "ライブ音楽", en: "Live Music" },
  pubCount: 0,
};

function request(body: string, bearer: string | null = token, contentType = "application/json") {
  return new Request("https://example.com/api/automation/v1/tags", {
    method: "POST",
    headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), "content-type": contentType },
    body,
  });
}

beforeEach(() => {
  process.env.AUTOMATION_API_TOKEN_SHA256 = createHash("sha256").update(token).digest("hex");
  process.env.AUTOMATION_API_SCOPES = "tag:create";
  process.env.DATABASE_URL = "postgres://test-only";
  repositoryMocks.createAdminTag.mockReset();
});

afterEach(() => {
  for (const [name, original] of [
    ["AUTOMATION_API_TOKEN_SHA256", originalHash],
    ["AUTOMATION_API_SCOPES", originalScopes],
    ["DATABASE_URL", originalDatabaseUrl],
  ] as const) {
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
});

describe("automation tag create API", () => {
  it("requires a valid Bearer Token and tag:create without accepting a management session", async () => {
    const body = JSON.stringify({ key: "live-music", translations: { ja: "ライブ音楽" } });
    for (const bearer of [null, "invalid"]) {
      const response = await POST(request(body, bearer));
      expect(response.status).toBe(401);
      expect(response.headers.get("www-authenticate")).toBe("Bearer");
    }
    const cookieOnly = request(body, null);
    cookieOnly.headers.set("cookie", "admin_session=test-only-session");
    expect((await POST(cookieOnly)).status).toBe(401);
    process.env.AUTOMATION_API_SCOPES = "master:read";
    const forbidden = await POST(request(body));
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toEqual({ errorCode: "forbidden" });
    expect(repositoryMocks.createAdminTag).not.toHaveBeenCalled();
  });

  it("creates a tag through the existing repository and shared normalized input", async () => {
    repositoryMocks.createAdminTag.mockResolvedValue(tag);
    const response = await POST(
      request(JSON.stringify({ key: "live-music", translations: { ja: " ライブ音楽 ", en: " Live Music " } })),
    );
    expect(response.status).toBe(201);
    expect(repositoryMocks.createAdminTag).toHaveBeenCalledWith(
      { key: "live-music", translations: { ja: "ライブ音楽", en: "Live Music" } },
      "550e8400-e29b-41d4-a716-446655440001",
    );
    await expect(response.json()).resolves.toEqual({ tag });
  });

  it("rejects non-JSON, malformed JSON, invalid keys, and missing Japanese names", async () => {
    expect((await POST(request("{}", token, "text/plain"))).status).toBe(415);
    expect((await POST(request("{"))).status).toBe(400);
    const invalid = await POST(request(JSON.stringify({ key: "Invalid Key", translations: { ja: "" } })));
    expect(invalid.status).toBe(422);
    await expect(invalid.json()).resolves.toMatchObject({
      errorCode: "validation_error",
      fieldErrors: { key: "invalid_format", "translations.ja": "required" },
    });
    expect(repositoryMocks.createAdminTag).not.toHaveBeenCalled();
  });

  it("reuses conflict mapping for duplicate keys or locale names and hides unexpected failures", async () => {
    const body = JSON.stringify({ key: "live-music", translations: { ja: "ライブ音楽" } });
    repositoryMocks.createAdminTag.mockRejectedValueOnce(new repositoryMocks.TagRepositoryError("conflict"));
    const conflict = await POST(request(body));
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({ errorCode: "tag_conflict" });

    repositoryMocks.createAdminTag.mockRejectedValueOnce(new Error("database connection detail"));
    const failure = await POST(request(body));
    expect(failure.status).toBe(500);
    await expect(failure.json()).resolves.toEqual({ errorCode: "internal_error" });
  });

  it("does not attempt to write without a configured database", async () => {
    delete process.env.DATABASE_URL;
    const response = await POST(request(JSON.stringify({ key: "live-music", translations: { ja: "ライブ音楽" } })));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ errorCode: "database_unavailable" });
    expect(repositoryMocks.createAdminTag).not.toHaveBeenCalled();
  });
});
