// 営業ステータス管理APIの認証、Origin、入力、固定key、存在確認、内部エラー一般化を保証します。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "../../apps/web/app/lib/admin-auth";

const repositoryMocks = vi.hoisted(() => {
  class StatusRepositoryError extends Error {
    constructor(readonly code: "not_found") {
      super(code);
    }
  }
  return {
    StatusRepositoryError,
    getAdminPubStatuses: vi.fn(),
    updateAdminPubStatus: vi.fn(),
  };
});

vi.mock("../../apps/web/app/lib/status-repository", () => repositoryMocks);

import { PATCH } from "../../apps/web/app/api/admin/statuses/[code]/route";
import { GET } from "../../apps/web/app/api/admin/statuses/route";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalSessionSecret = process.env.ADMIN_SESSION_SECRET;
const originalAdminUsername = process.env.ADMIN_USERNAME;
const originalPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const origin = "https://example.com";
const status = { code: 1, key: "open", nameJa: "営業中", nameEn: "Open" };

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test-only";
  process.env.ADMIN_SESSION_SECRET = "test-only-session-secret";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD_HASH = "test-only-hash";
  repositoryMocks.getAdminPubStatuses.mockReset();
  repositoryMocks.updateAdminPubStatus.mockReset();
});

afterEach(() => {
  restoreEnvironmentVariable("DATABASE_URL", originalDatabaseUrl);
  restoreEnvironmentVariable("ADMIN_SESSION_SECRET", originalSessionSecret);
  restoreEnvironmentVariable("ADMIN_USERNAME", originalAdminUsername);
  restoreEnvironmentVariable("ADMIN_PASSWORD_HASH", originalPasswordHash);
});

describe("admin statuses API", () => {
  it("returns statuses to an authenticated administrator and rejects unauthenticated access", async () => {
    repositoryMocks.getAdminPubStatuses.mockResolvedValue([status]);
    const response = await GET(adminRequest("/api/admin/statuses"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ statuses: [status], databaseConfigured: true });

    const unauthorized = await GET(new Request(`${origin}/api/admin/statuses`));
    expect(unauthorized.status).toBe(401);
    expect(repositoryMocks.getAdminPubStatuses).toHaveBeenCalledOnce();
  });

  it("updates normalized names and ignores a key in the request", async () => {
    repositoryMocks.updateAdminPubStatus.mockResolvedValue({ ...status, nameEn: null });
    const response = await PATCH(
      adminRequest(
        "/api/admin/statuses/1",
        "PATCH",
        JSON.stringify({ key: "changed", nameJa: "  営業中  ", nameEn: " " }),
      ),
      context("1"),
    );
    expect(response.status).toBe(200);
    expect(repositoryMocks.updateAdminPubStatus).toHaveBeenCalledWith(1, { nameJa: "営業中", nameEn: null });
  });

  it("rejects an unauthenticated update before persistence", async () => {
    const response = await PATCH(
      new Request(`${origin}/api/admin/statuses/1`, {
        method: "PATCH",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ nameJa: "営業中" }),
      }),
      context("1"),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ errorCode: "unauthorized" });
    expect(repositoryMocks.updateAdminPubStatus).not.toHaveBeenCalled();
  });

  it("rejects Origin, content type, JSON, code, and invalid names before persistence", async () => {
    expect(
      (
        await PATCH(
          adminRequest("/api/admin/statuses/1", "PATCH", JSON.stringify({ nameJa: "営業中" }), null),
          context("1"),
        )
      ).status,
    ).toBe(403);
    expect((await PATCH(adminRequest("/api/admin/statuses/1", "PATCH"), context("1"))).status).toBe(415);
    expect((await PATCH(adminRequest("/api/admin/statuses/1", "PATCH", "{"), context("1"))).status).toBe(400);

    const invalidCode = await PATCH(
      adminRequest("/api/admin/statuses/0", "PATCH", JSON.stringify({ nameJa: "営業中" })),
      context("0"),
    );
    expect(invalidCode.status).toBe(400);
    await expect(invalidCode.json()).resolves.toEqual({ errorCode: "invalid_status_code" });

    const invalidName = await PATCH(
      adminRequest("/api/admin/statuses/1", "PATCH", JSON.stringify({ nameJa: " " })),
      context("1"),
    );
    expect(invalidName.status).toBe(422);
    await expect(invalidName.json()).resolves.toEqual({
      errorCode: "validation_error",
      fieldErrors: { nameJa: "required" },
    });
    expect(repositoryMocks.updateAdminPubStatus).not.toHaveBeenCalled();
  });

  it("returns not-found, database, and safe internal errors", async () => {
    repositoryMocks.updateAdminPubStatus.mockRejectedValue(new repositoryMocks.StatusRepositoryError("not_found"));
    const missing = await PATCH(
      adminRequest("/api/admin/statuses/99", "PATCH", JSON.stringify({ nameJa: "不存在" })),
      context("99"),
    );
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ errorCode: "status_not_found" });

    delete process.env.DATABASE_URL;
    const unavailable = await PATCH(
      adminRequest("/api/admin/statuses/1", "PATCH", JSON.stringify({ nameJa: "営業中" })),
      context("1"),
    );
    expect(unavailable.status).toBe(503);

    process.env.DATABASE_URL = "postgres://test-only";
    repositoryMocks.getAdminPubStatuses.mockRejectedValue(new Error("database connection detail"));
    const failed = await GET(adminRequest("/api/admin/statuses"));
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({ errorCode: "internal_error" });

    repositoryMocks.updateAdminPubStatus.mockRejectedValue(new Error("database connection detail"));
    const updateFailed = await PATCH(
      adminRequest("/api/admin/statuses/1", "PATCH", JSON.stringify({ nameJa: "営業中" })),
      context("1"),
    );
    expect(updateFailed.status).toBe(500);
    await expect(updateFailed.json()).resolves.toEqual({ errorCode: "internal_error" });
  });
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

function context(code: string) {
  return { params: Promise.resolve({ code }) };
}

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
