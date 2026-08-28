// タグ管理APIの認証、Origin、入力契約、競合、使用中削除拒否、内部エラー一般化を保証します。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "../../apps/web/app/lib/admin-auth";

const repositoryMocks = vi.hoisted(() => {
  class TagRepositoryError extends Error {
    constructor(readonly code: "conflict" | "in_use" | "not_found") {
      super(code);
    }
  }
  return {
    TagRepositoryError,
    createAdminTag: vi.fn(),
    deleteAdminTag: vi.fn(),
    getAdminTags: vi.fn(),
    updateAdminTag: vi.fn(),
  };
});

vi.mock("../../apps/web/app/lib/tag-repository", () => repositoryMocks);

import { DELETE, PATCH } from "../../apps/web/app/api/admin/tags/[id]/route";
import { GET, POST } from "../../apps/web/app/api/admin/tags/route";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalSessionSecret = process.env.ADMIN_SESSION_SECRET;
const originalAdminUsername = process.env.ADMIN_USERNAME;
const originalPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const origin = "https://example.com";
const tagId = "550e8400-e29b-41d4-a716-446655440001";
const tag = { id: tagId, key: "whiskey", nameJa: "ウイスキー", nameEn: "Whiskey", pubCount: 2 };

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test-only";
  process.env.ADMIN_SESSION_SECRET = "test-only-session-secret";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD_HASH = "test-only-hash";
  for (const mock of [
    repositoryMocks.createAdminTag,
    repositoryMocks.deleteAdminTag,
    repositoryMocks.getAdminTags,
    repositoryMocks.updateAdminTag,
  ]) {
    mock.mockReset();
  }
});

afterEach(() => {
  restoreEnvironmentVariable("DATABASE_URL", originalDatabaseUrl);
  restoreEnvironmentVariable("ADMIN_SESSION_SECRET", originalSessionSecret);
  restoreEnvironmentVariable("ADMIN_USERNAME", originalAdminUsername);
  restoreEnvironmentVariable("ADMIN_PASSWORD_HASH", originalPasswordHash);
});

function adminRequest(path: string, method = "GET", body?: string, requestOrigin: string | null = origin) {
  const session = createAdminSession("admin");
  return new Request(`${origin}${path}`, {
    method,
    headers: {
      cookie: `${ADMIN_SESSION_COOKIE}=${session}`,
      ...(requestOrigin ? { origin: requestOrigin } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body,
  });
}

function context(id = tagId) {
  return { params: Promise.resolve({ id }) };
}

describe("admin tags API", () => {
  it("returns tags to an authenticated administrator and rejects unauthenticated access", async () => {
    repositoryMocks.getAdminTags.mockResolvedValue([tag]);

    const response = await GET(adminRequest("/api/admin/tags"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ tags: [tag], databaseConfigured: true });

    const unauthorized = await GET(new Request(`${origin}/api/admin/tags`));
    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toEqual({ errorCode: "unauthorized" });
  });

  it("creates a normalized Japanese-only tag with authentication and exact Origin", async () => {
    repositoryMocks.createAdminTag.mockResolvedValue({ ...tag, key: "food", nameJa: "食事あり", nameEn: null });

    const response = await POST(
      adminRequest("/api/admin/tags", "POST", JSON.stringify({ key: "food", nameJa: "  食事あり  ", nameEn: "" })),
    );

    expect(response.status).toBe(201);
    expect(repositoryMocks.createAdminTag).toHaveBeenCalledWith({ key: "food", nameJa: "食事あり", nameEn: null });
  });

  it("rejects missing Origin, non-JSON content, malformed JSON, and invalid fields before persistence", async () => {
    expect(
      (await POST(adminRequest("/api/admin/tags", "POST", JSON.stringify({ key: "food", nameJa: "食事" }), null)))
        .status,
    ).toBe(403);

    const nonJson = adminRequest("/api/admin/tags", "POST");
    expect((await POST(nonJson)).status).toBe(415);

    expect((await POST(adminRequest("/api/admin/tags", "POST", "{"))).status).toBe(400);
    const invalid = await POST(
      adminRequest("/api/admin/tags", "POST", JSON.stringify({ key: "Invalid Key", nameJa: "" })),
    );
    expect(invalid.status).toBe(422);
    await expect(invalid.json()).resolves.toMatchObject({
      errorCode: "validation_error",
      fieldErrors: { key: "invalid_format", nameJa: "required" },
    });
    expect(repositoryMocks.createAdminTag).not.toHaveBeenCalled();
  });

  it("maps duplicate keys or names to a general conflict response", async () => {
    repositoryMocks.createAdminTag.mockRejectedValue(new repositoryMocks.TagRepositoryError("conflict"));

    const response = await POST(
      adminRequest("/api/admin/tags", "POST", JSON.stringify({ key: "whiskey", nameJa: "ウイスキー" })),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ errorCode: "tag_conflict" });
  });

  it("updates display names without accepting a key change", async () => {
    repositoryMocks.updateAdminTag.mockResolvedValue({ ...tag, nameEn: null });
    const response = await PATCH(
      adminRequest(`/api/admin/tags/${tagId}`, "PATCH", JSON.stringify({ nameJa: "ウイスキー", nameEn: "" })),
      context(),
    );

    expect(response.status).toBe(200);
    expect(repositoryMocks.updateAdminTag).toHaveBeenCalledWith(tagId, { nameJa: "ウイスキー", nameEn: null });

    const keyChange = await PATCH(
      adminRequest(`/api/admin/tags/${tagId}`, "PATCH", JSON.stringify({ key: "changed", nameJa: "ウイスキー" })),
      context(),
    );
    expect(keyChange.status).toBe(422);
    await expect(keyChange.json()).resolves.toEqual({
      errorCode: "validation_error",
      fieldErrors: { key: "immutable" },
    });
  });

  it("returns 400 for an invalid id and 404 for a missing tag", async () => {
    const invalidId = await PATCH(
      adminRequest("/api/admin/tags/invalid", "PATCH", JSON.stringify({ nameJa: "表示名" })),
      context("invalid"),
    );
    expect(invalidId.status).toBe(400);
    await expect(invalidId.json()).resolves.toEqual({ errorCode: "invalid_tag_id" });

    repositoryMocks.updateAdminTag.mockRejectedValue(new repositoryMocks.TagRepositoryError("not_found"));
    const missing = await PATCH(
      adminRequest(`/api/admin/tags/${tagId}`, "PATCH", JSON.stringify({ nameJa: "表示名" })),
      context(),
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ errorCode: "tag_not_found" });
  });

  it("deletes an unused tag and rejects an in-use tag", async () => {
    repositoryMocks.deleteAdminTag.mockResolvedValueOnce(undefined);
    const deleted = await DELETE(adminRequest(`/api/admin/tags/${tagId}`, "DELETE"), context());
    expect(deleted.status).toBe(200);

    repositoryMocks.deleteAdminTag.mockRejectedValueOnce(new repositoryMocks.TagRepositoryError("in_use"));
    const inUse = await DELETE(adminRequest(`/api/admin/tags/${tagId}`, "DELETE"), context());
    expect(inUse.status).toBe(409);
    await expect(inUse.json()).resolves.toEqual({ errorCode: "tag_in_use" });
  });

  it("returns 503 without a database and hides unexpected repository errors", async () => {
    delete process.env.DATABASE_URL;
    const unavailable = await POST(
      adminRequest("/api/admin/tags", "POST", JSON.stringify({ key: "food", nameJa: "食事" })),
    );
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({ errorCode: "database_unavailable" });

    process.env.DATABASE_URL = "postgres://test-only";
    repositoryMocks.getAdminTags.mockRejectedValue(new Error("database connection detail"));
    const response = await GET(adminRequest("/api/admin/tags"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ errorCode: "internal_error" });
  });
});

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
