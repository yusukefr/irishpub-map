import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "../../apps/web/app/lib/admin-auth";

const repositoryMocks = vi.hoisted(() => ({
  isContentDatabaseConfigured: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/admin-content-repository", () => repositoryMocks);

const serviceMocks = vi.hoisted(() => ({
  AdminContentServiceError: class AdminContentServiceError extends Error {
    constructor(
      readonly code: "validation" | "conflict" | "not_found" | "publication_requirements_not_met",
      readonly fieldErrors: Record<string, string> = {},
      readonly missingFields: string[] = [],
    ) {
      super();
    }
  },
  changeAdminContentPublication: vi.fn(),
  createAdminContent: vi.fn(),
  readAdminContent: vi.fn(),
  readAdminContentList: vi.fn(),
  updateAdminContent: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/admin-content-service", () => serviceMocks);

import { GET as GET_DETAIL, PUT } from "../../apps/web/app/api/admin/content/[id]/route";
import { PATCH } from "../../apps/web/app/api/admin/content/[id]/publication/route";
import { GET, POST } from "../../apps/web/app/api/admin/content/route";

const originalSessionSecret = process.env.ADMIN_SESSION_SECRET;
const originalAdminUsername = process.env.ADMIN_USERNAME;
const originalPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const id = "550e8400-e29b-41d4-a716-446655440001";

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "test-only-session-secret";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD_HASH = "test-only-hash";
  repositoryMocks.isContentDatabaseConfigured.mockReset();
  repositoryMocks.isContentDatabaseConfigured.mockReturnValue(true);
  for (const mock of [
    serviceMocks.changeAdminContentPublication,
    serviceMocks.createAdminContent,
    serviceMocks.readAdminContent,
    serviceMocks.readAdminContentList,
    serviceMocks.updateAdminContent,
  ]) {
    mock.mockReset();
  }
});

afterEach(() => {
  if (originalSessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = originalSessionSecret;
  if (originalAdminUsername === undefined) delete process.env.ADMIN_USERNAME;
  else process.env.ADMIN_USERNAME = originalAdminUsername;
  if (originalPasswordHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = originalPasswordHash;
});

describe("admin content API", () => {
  it("rejects unauthenticated list access", async () => {
    const response = await GET(new Request("http://localhost/api/admin/content"));
    expect(response.status).toBe(401);
    expect(serviceMocks.readAdminContentList).not.toHaveBeenCalled();
  });

  it("returns Draft and Published content to an authenticated administrator", async () => {
    serviceMocks.readAdminContentList.mockResolvedValue([
      { id, status: "draft", titleJa: "下書き" },
      { id: id.replace(/1$/, "2"), status: "published", titleJa: "公開済み" },
    ]);
    const response = await GET(adminRequest("/api/admin/content"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      content: [{ status: "draft" }, { status: "published" }],
      databaseConfigured: true,
    });
  });

  it("requires same-origin JSON and creates a Draft", async () => {
    const forbidden = await POST(adminRequest("/api/admin/content", "POST", "{}", "https://example.com"));
    expect(forbidden.status).toBe(403);

    const unsupported = await POST(adminRequest("/api/admin/content", "POST"));
    expect(unsupported.status).toBe(415);

    serviceMocks.createAdminContent.mockResolvedValue({ id, status: "draft" });
    const response = await POST(adminRequest("/api/admin/content", "POST", "{}"));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ content: { id, status: "draft" } });
  });

  it("maps validation, conflicts, missing content, and publication requirements", async () => {
    serviceMocks.createAdminContent.mockRejectedValue(
      new serviceMocks.AdminContentServiceError("conflict", { slug: "invalid_format" }),
    );
    const conflict = await POST(adminRequest("/api/admin/content", "POST", "{}"));
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({
      errorCode: "content_conflict",
      fieldErrors: { slug: "invalid_format" },
    });

    serviceMocks.readAdminContent.mockRejectedValue(new serviceMocks.AdminContentServiceError("not_found"));
    const missing = await GET_DETAIL(adminRequest("/api/admin/content/" + id), context(id));
    expect(missing.status).toBe(404);

    serviceMocks.updateAdminContent.mockRejectedValue(
      new serviceMocks.AdminContentServiceError("publication_requirements_not_met", {}, ["translations.en.title"]),
    );
    const blocked = await PUT(adminRequest("/api/admin/content/" + id, "PUT", "{}"), context(id));
    expect(blocked.status).toBe(422);
    await expect(blocked.json()).resolves.toEqual({
      errorCode: "publication_requirements_not_met",
      missingFields: ["translations.en.title"],
    });
  });

  it("validates publication input and returns publication state", async () => {
    const invalid = await PATCH(
      adminRequest("/api/admin/content/" + id + "/publication", "PATCH", JSON.stringify({ status: "public" })),
      context(id),
    );
    expect(invalid.status).toBe(422);

    serviceMocks.changeAdminContentPublication.mockResolvedValue({
      id,
      status: "published",
      unchanged: false,
      publishedAt: "2026-09-11T02:30:00.000Z",
    });
    const response = await PATCH(
      adminRequest("/api/admin/content/" + id + "/publication", "PATCH", JSON.stringify({ status: "published" })),
      context(id),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      publication: {
        id,
        status: "published",
        unchanged: false,
        publishedAt: "2026-09-11T02:30:00.000Z",
      },
    });
  });

  it("returns 503 before mutations when the database is unavailable", async () => {
    repositoryMocks.isContentDatabaseConfigured.mockReturnValue(false);
    const response = await POST(adminRequest("/api/admin/content", "POST", "{}"));
    expect(response.status).toBe(503);
    expect(serviceMocks.createAdminContent).not.toHaveBeenCalled();
  });
});

function adminRequest(path: string, method = "GET", body?: string, origin = "http://localhost") {
  const session = createAdminSession("admin");
  return new Request("http://localhost" + path, {
    method,
    headers: {
      cookie: `${ADMIN_SESSION_COOKIE}=${session}`,
      ...(method === "GET" ? {} : { origin }),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body,
  });
}

function context(contentId: string) {
  return { params: Promise.resolve({ id: contentId }) };
}
