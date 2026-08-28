// 管理店舗APIが認証済み管理者だけへ公開・非公開店舗を返すことを保証します。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "../../apps/web/app/lib/admin-auth";

const repositoryMocks = vi.hoisted(() => ({
  PubInputValidationError: class PubInputValidationError extends Error {},
  createPub: vi.fn(),
  deletePub: vi.fn(),
  getAdminPubs: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  updatePub: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/pub-repository", () => repositoryMocks);

import { DELETE, PUT } from "../../apps/web/app/api/admin/pubs/[id]/route";
import { GET, POST } from "../../apps/web/app/api/admin/pubs/route";

const originalSessionSecret = process.env.ADMIN_SESSION_SECRET;
const originalAdminUsername = process.env.ADMIN_USERNAME;
const originalPasswordHash = process.env.ADMIN_PASSWORD_HASH;

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "test-only-session-secret";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD_HASH = "test-only-hash";
  repositoryMocks.getAdminPubs.mockReset();
  repositoryMocks.getAdminPubs.mockResolvedValue([
    { id: "pub-1", name: "Published", isPublished: true },
    { id: "pub-2", name: "Draft", isPublished: false },
  ]);
  repositoryMocks.isDatabaseConfigured.mockReset();
  repositoryMocks.isDatabaseConfigured.mockReturnValue(true);
  repositoryMocks.createPub.mockReset();
  repositoryMocks.deletePub.mockReset();
  repositoryMocks.updatePub.mockReset();
});

afterEach(() => {
  if (originalSessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = originalSessionSecret;
  if (originalAdminUsername === undefined) delete process.env.ADMIN_USERNAME;
  else process.env.ADMIN_USERNAME = originalAdminUsername;
  if (originalPasswordHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = originalPasswordHash;
});

describe("GET /api/admin/pubs", () => {
  it("rejects unauthenticated requests before reading pubs", async () => {
    const response = await GET(new Request("http://localhost/api/admin/pubs"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ errorCode: "unauthorized" });
    expect(repositoryMocks.getAdminPubs).not.toHaveBeenCalled();
  });

  it("returns both publication states to an authenticated administrator", async () => {
    const session = createAdminSession("admin");
    const response = await GET(
      new Request("http://localhost/api/admin/pubs", {
        headers: { cookie: `${ADMIN_SESSION_COOKIE}=${session}` },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      pubs: [
        { id: "pub-1", name: "Published", isPublished: true },
        { id: "pub-2", name: "Draft", isPublished: false },
      ],
      databaseConfigured: true,
    });
    expect(response.status).toBe(200);
  });

  it("hides unexpected repository errors", async () => {
    repositoryMocks.getAdminPubs.mockRejectedValue(new Error("database connection detail"));
    const response = await GET(adminRequest("/api/admin/pubs"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ errorCode: "internal_error" });
  });
});

describe("admin pub mutations", () => {
  it("preserves input and database status codes", async () => {
    const nonJson = await POST(adminRequest("/api/admin/pubs", "POST"));
    expect(nonJson.status).toBe(415);
    await expect(nonJson.json()).resolves.toEqual({ errorCode: "invalid_content_type" });

    const malformed = await POST(adminRequest("/api/admin/pubs", "POST", "{"));
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({ errorCode: "invalid_json" });

    repositoryMocks.createPub.mockRejectedValue(new repositoryMocks.PubInputValidationError());
    const invalid = await POST(adminRequest("/api/admin/pubs", "POST", "{}"));
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ errorCode: "invalid_pub_data" });

    repositoryMocks.isDatabaseConfigured.mockReturnValue(false);
    const unavailable = await POST(adminRequest("/api/admin/pubs", "POST", "{}"));
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({ errorCode: "database_unavailable" });
  });

  it("returns not-found codes and hides mutation errors", async () => {
    repositoryMocks.updatePub.mockResolvedValue(null);
    const missing = await PUT(adminRequest("/api/admin/pubs/missing", "PUT", "{}"), context("missing"));
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ errorCode: "pub_not_found" });

    repositoryMocks.deletePub.mockRejectedValue(new Error("database connection detail"));
    const failed = await DELETE(adminRequest("/api/admin/pubs/pub-1", "DELETE"), context("pub-1"));
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({ errorCode: "internal_error" });
  });
});

function adminRequest(path: string, method = "GET", body?: string) {
  const session = createAdminSession("admin");
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      cookie: `${ADMIN_SESSION_COOKIE}=${session}`,
      ...(method === "GET" ? {} : { origin: "http://localhost" }),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body,
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}
