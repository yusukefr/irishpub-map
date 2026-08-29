// 管理店舗APIが認証済み管理者だけへ公開・非公開店舗を返すことを保証します。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "../../apps/web/app/lib/admin-auth";

const repositoryMocks = vi.hoisted(() => ({
  PubInputValidationError: class PubInputValidationError extends Error {},
  PubPublicationValidationError: class PubPublicationValidationError extends Error {
    constructor(readonly missingFields: string[]) {
      super();
    }
  },
  createPub: vi.fn(),
  deletePub: vi.fn(),
  getAdminPubPage: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  setAdminPubPublication: vi.fn(),
  updatePub: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/pub-repository", () => repositoryMocks);

import { DELETE, PUT } from "../../apps/web/app/api/admin/pubs/[id]/route";
import { PATCH } from "../../apps/web/app/api/admin/pubs/[id]/publication/route";
import { GET, POST } from "../../apps/web/app/api/admin/pubs/route";

const originalSessionSecret = process.env.ADMIN_SESSION_SECRET;
const originalAdminUsername = process.env.ADMIN_USERNAME;
const originalPasswordHash = process.env.ADMIN_PASSWORD_HASH;

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "test-only-session-secret";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD_HASH = "test-only-hash";
  repositoryMocks.getAdminPubPage.mockReset();
  repositoryMocks.getAdminPubPage.mockResolvedValue({
    pubs: [
      { id: "pub-1", name: "Published", isPublished: true },
      { id: "pub-2", name: "Draft", isPublished: false },
    ],
    total: 2,
    page: 1,
    pageSize: 50,
  });
  repositoryMocks.isDatabaseConfigured.mockReset();
  repositoryMocks.isDatabaseConfigured.mockReturnValue(true);
  repositoryMocks.createPub.mockReset();
  repositoryMocks.deletePub.mockReset();
  repositoryMocks.setAdminPubPublication.mockReset();
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
    expect(repositoryMocks.getAdminPubPage).not.toHaveBeenCalled();
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
      total: 2,
      page: 1,
      pageSize: 50,
      databaseConfigured: true,
    });
    expect(response.status).toBe(200);
  });

  it("hides unexpected repository errors", async () => {
    repositoryMocks.getAdminPubPage.mockRejectedValue(new Error("database connection detail"));
    const response = await GET(adminRequest("/api/admin/pubs"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ errorCode: "internal_error" });
  });

  it("validates and forwards combined search conditions", async () => {
    const response = await GET(
      adminRequest(
        "/api/admin/pubs?name=Irish&prefecture=23&municipality=231002&status=open&tag=550e8400-e29b-41d4-a716-446655440010&published=false&page=2",
      ),
    );
    expect(response.status).toBe(200);
    expect(repositoryMocks.getAdminPubPage).toHaveBeenCalledWith({
      name: "Irish",
      prefectureCode: 23,
      municipalityCode: "231002",
      statusKey: "open",
      tagId: "550e8400-e29b-41d4-a716-446655440010",
      isPublished: false,
      page: 2,
    });
  });

  it("rejects invalid search parameters before reading pubs", async () => {
    const response = await GET(adminRequest("/api/admin/pubs?published=yes"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ errorCode: "invalid_request" });
    expect(repositoryMocks.getAdminPubPage).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/pubs/:id/publication", () => {
  const pubId = "550e8400-e29b-41d4-a716-446655440001";

  it("requires authentication, same-origin JSON, and a valid UUID", async () => {
    const unauthenticated = await PATCH(
      new Request(`http://localhost/api/admin/pubs/${pubId}/publication`, {
        method: "PATCH",
        headers: { origin: "http://localhost", "content-type": "application/json" },
        body: JSON.stringify({ isPublished: true }),
      }),
      context(pubId),
    );
    expect(unauthenticated.status).toBe(401);

    const forbidden = await PATCH(
      adminRequest(
        `/api/admin/pubs/${pubId}/publication`,
        "PATCH",
        JSON.stringify({ isPublished: true }),
        "https://evil.example",
      ),
      context(pubId),
    );
    expect(forbidden.status).toBe(403);

    const invalidId = await PATCH(
      adminRequest("/api/admin/pubs/invalid/publication", "PATCH", JSON.stringify({ isPublished: true })),
      context("invalid"),
    );
    expect(invalidId.status).toBe(400);
    expect(repositoryMocks.setAdminPubPublication).not.toHaveBeenCalled();
  });

  it("publishes and unpublishes through the dedicated repository operation", async () => {
    repositoryMocks.setAdminPubPublication.mockResolvedValueOnce({ id: pubId, isPublished: true, unchanged: false });
    const published = await PATCH(
      adminRequest(`/api/admin/pubs/${pubId}/publication`, "PATCH", JSON.stringify({ isPublished: true })),
      context(pubId),
    );
    expect(published.status).toBe(200);
    await expect(published.json()).resolves.toEqual({
      publication: { id: pubId, isPublished: true, unchanged: false },
    });

    repositoryMocks.setAdminPubPublication.mockResolvedValueOnce({ id: pubId, isPublished: false, unchanged: false });
    const unpublished = await PATCH(
      adminRequest(`/api/admin/pubs/${pubId}/publication`, "PATCH", JSON.stringify({ isPublished: false })),
      context(pubId),
    );
    expect(unpublished.status).toBe(200);
    expect(repositoryMocks.setAdminPubPublication).toHaveBeenLastCalledWith(pubId, false);
  });

  it("returns missing publication fields without changing state", async () => {
    repositoryMocks.setAdminPubPublication.mockRejectedValue(
      new repositoryMocks.PubPublicationValidationError(["address", "latitude"]),
    );
    const response = await PATCH(
      adminRequest(`/api/admin/pubs/${pubId}/publication`, "PATCH", JSON.stringify({ isPublished: true })),
      context(pubId),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      errorCode: "publication_requirements_not_met",
      missingFields: ["address", "latitude"],
    });
  });

  it("rejects malformed input and reports a missing pub", async () => {
    const invalid = await PATCH(
      adminRequest(`/api/admin/pubs/${pubId}/publication`, "PATCH", JSON.stringify({ isPublished: "yes" })),
      context(pubId),
    );
    expect(invalid.status).toBe(422);

    repositoryMocks.setAdminPubPublication.mockResolvedValue(null);
    const missing = await PATCH(
      adminRequest(`/api/admin/pubs/${pubId}/publication`, "PATCH", JSON.stringify({ isPublished: true })),
      context(pubId),
    );
    expect(missing.status).toBe(404);
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

function adminRequest(path: string, method = "GET", body?: string, origin = "http://localhost") {
  const session = createAdminSession("admin");
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      cookie: `${ADMIN_SESSION_COOKIE}=${session}`,
      ...(method === "GET" ? {} : { origin }),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body,
  });
}

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}
