import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  PubPublicationValidationError: class PubPublicationValidationError extends Error {
    constructor(readonly missingFields: string[]) {
      super();
    }
  },
  getAdminPubPage: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  setAdminPubPublication: vi.fn(),
}));
vi.mock("../../apps/web/app/lib/pub-repository", () => repositoryMocks);

const serviceMocks = vi.hoisted(() => ({
  AdminPubServiceError: class AdminPubServiceError extends Error {
    constructor(
      readonly code: "validation" | "reference_conflict" | "not_found" | "publication_requirements_not_met",
      readonly fieldErrors: Record<string, string> = {},
      readonly missingFields: string[] = [],
    ) {
      super();
    }
  },
  createAdminPub: vi.fn(),
  readAdminPub: vi.fn(),
  updateAdminPub: vi.fn(),
}));
vi.mock("../../apps/web/app/lib/admin-pub-service", () => serviceMocks);

import * as pubDetailRoute from "../../apps/web/app/api/automation/v1/pubs/[id]/route";
import { PATCH } from "../../apps/web/app/api/automation/v1/pubs/[id]/publication/route";
import { GET as GET_DETAIL, PUT } from "../../apps/web/app/api/automation/v1/pubs/[id]/route";
import { GET, POST } from "../../apps/web/app/api/automation/v1/pubs/route";

const token = "test-only-automation-token";
const id = "550e8400-e29b-41d4-a716-446655440001";
const tagId = "550e8400-e29b-41d4-a716-446655440010";
const originalHash = process.env.AUTOMATION_API_TOKEN_SHA256;
const originalScopes = process.env.AUTOMATION_API_SCOPES;
const context = (pubId: string) => ({ params: Promise.resolve({ id: pubId }) });

function request(path: string, method: string, scopes: string, body?: string, contentType = "application/json") {
  process.env.AUTOMATION_API_SCOPES = scopes;
  return new Request(`https://example.com${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": contentType },
    ...(body === undefined ? {} : { body }),
  });
}

const draftInput = {
  prefectureCode: 23,
  municipalityCode: "231061",
  latitude: 35.1709,
  longitude: 136.8815,
  websiteUrl: "https://example.com",
  googleMapsUrl: null,
  instagramUrl: null,
  status: "open",
  translations: { ja: { name: "Example Pub", nameReading: null, address: "名古屋市" }, en: null },
  tagIds: [tagId],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTOMATION_API_TOKEN_SHA256 = createHash("sha256").update(token).digest("hex");
  process.env.AUTOMATION_API_SCOPES = "pubs:read,pubs:create,pubs:update,pubs:publish";
  repositoryMocks.isDatabaseConfigured.mockReturnValue(true);
  repositoryMocks.getAdminPubPage.mockResolvedValue({ pubs: [], total: 0, page: 1, pageSize: 50 });
  repositoryMocks.setAdminPubPublication.mockResolvedValue({ id, isPublished: true, unchanged: false });
  serviceMocks.createAdminPub.mockResolvedValue({ id, isPublished: false, ...draftInput });
  serviceMocks.readAdminPub.mockResolvedValue({ id, isPublished: false, ...draftInput });
  serviceMocks.updateAdminPub.mockResolvedValue({ id, isPublished: false, ...draftInput });
});

afterEach(() => {
  if (originalHash === undefined) delete process.env.AUTOMATION_API_TOKEN_SHA256;
  else process.env.AUTOMATION_API_TOKEN_SHA256 = originalHash;
  if (originalScopes === undefined) delete process.env.AUTOMATION_API_SCOPES;
  else process.env.AUTOMATION_API_SCOPES = originalScopes;
});

describe("Automation Pub API", () => {
  it("uses the admin search parser and pagination for all supported filters", async () => {
    const response = await GET(
      request(
        `/api/automation/v1/pubs?name=Irish&prefecture=23&municipality=231061&status=open&tag=${tagId}&published=false&page=2`,
        "GET",
        "pubs:read",
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      pubs: [],
      total: 0,
      page: 1,
      pageSize: 50,
      databaseConfigured: true,
    });
    expect(repositoryMocks.getAdminPubPage).toHaveBeenCalledWith(
      {
        name: "Irish",
        prefectureCode: 23,
        municipalityCode: "231061",
        statusKey: "open",
        tagId,
        isPublished: false,
        page: 2,
      },
      "ja",
    );
  });

  it("rejects invalid search queries and hides repository errors", async () => {
    const invalid = await GET(request("/api/automation/v1/pubs?published=yes", "GET", "pubs:read"));
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ errorCode: "invalid_request" });
    expect(repositoryMocks.getAdminPubPage).not.toHaveBeenCalled();

    repositoryMocks.getAdminPubPage.mockRejectedValue(new Error("database detail"));
    const failed = await GET(request("/api/automation/v1/pubs", "GET", "pubs:read"));
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({ errorCode: "internal_error" });
  });

  it("returns a Draft detail and reports an invalid or missing ID", async () => {
    const detail = await GET_DETAIL(request(`/api/automation/v1/pubs/${id}`, "GET", "pubs:read"), context(id));
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toEqual({ pub: { id, isPublished: false, ...draftInput } });

    const invalid = await GET_DETAIL(
      request("/api/automation/v1/pubs/invalid", "GET", "pubs:read"),
      context("invalid"),
    );
    expect(invalid.status).toBe(400);
    serviceMocks.readAdminPub.mockRejectedValue(new serviceMocks.AdminPubServiceError("not_found"));
    const missing = await GET_DETAIL(request(`/api/automation/v1/pubs/${id}`, "GET", "pubs:read"), context(id));
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ errorCode: "pub_not_found" });
  });

  it("passes master codes and tag IDs to the shared create service and returns its Draft", async () => {
    const response = await POST(request("/api/automation/v1/pubs", "POST", "pubs:create", JSON.stringify(draftInput)));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ pub: { id, isPublished: false, ...draftInput } });
    expect(serviceMocks.createAdminPub).toHaveBeenCalledWith(draftInput);
  });

  it("updates the full snapshot through the shared service while retaining publication state", async () => {
    const response = await PUT(
      request(`/api/automation/v1/pubs/${id}`, "PUT", "pubs:update", JSON.stringify(draftInput)),
      context(id),
    );
    expect(response.status).toBe(200);
    expect(serviceMocks.updateAdminPub).toHaveBeenCalledWith(id, draftInput);
    await expect(response.json()).resolves.toEqual({ pub: { id, isPublished: false, ...draftInput } });
  });

  it("maps shared validation, reference and publication errors", async () => {
    serviceMocks.createAdminPub.mockRejectedValueOnce(
      new serviceMocks.AdminPubServiceError("validation", { isPublished: "immutable" }),
    );
    const invalidCreate = await POST(
      request("/api/automation/v1/pubs", "POST", "pubs:create", JSON.stringify({ ...draftInput, isPublished: true })),
    );
    expect(invalidCreate.status).toBe(422);
    await expect(invalidCreate.json()).resolves.toEqual({
      errorCode: "validation_error",
      fieldErrors: { isPublished: "immutable" },
    });

    serviceMocks.createAdminPub.mockRejectedValueOnce(
      new serviceMocks.AdminPubServiceError("reference_conflict", { tagIds: "invalid_format" }),
    );
    const invalidTag = await POST(
      request("/api/automation/v1/pubs", "POST", "pubs:create", JSON.stringify(draftInput)),
    );
    expect(invalidTag.status).toBe(409);
    await expect(invalidTag.json()).resolves.toEqual({
      errorCode: "validation_error",
      fieldErrors: { tagIds: "invalid_format" },
    });

    serviceMocks.updateAdminPub.mockRejectedValueOnce(
      new serviceMocks.AdminPubServiceError("publication_requirements_not_met", {}, ["address"]),
    );
    const blockedUpdate = await PUT(
      request(`/api/automation/v1/pubs/${id}`, "PUT", "pubs:update", JSON.stringify(draftInput)),
      context(id),
    );
    expect(blockedUpdate.status).toBe(422);
    await expect(blockedUpdate.json()).resolves.toEqual({
      errorCode: "publication_requirements_not_met",
      missingFields: ["address"],
    });
  });

  it("validates JSON, Content-Type, IDs and database availability before writing", async () => {
    const contentType = await POST(request("/api/automation/v1/pubs", "POST", "pubs:create", "{}", "text/plain"));
    expect(contentType.status).toBe(415);
    const json = await POST(request("/api/automation/v1/pubs", "POST", "pubs:create", "{"));
    expect(json.status).toBe(400);
    const invalidId = await PUT(
      request("/api/automation/v1/pubs/invalid", "PUT", "pubs:update", "{}"),
      context("invalid"),
    );
    expect(invalidId.status).toBe(400);
    repositoryMocks.isDatabaseConfigured.mockReturnValue(false);
    const unavailable = await POST(request("/api/automation/v1/pubs", "POST", "pubs:create", "{}"));
    expect(unavailable.status).toBe(503);
    expect(serviceMocks.createAdminPub).not.toHaveBeenCalled();
    expect(serviceMocks.updateAdminPub).not.toHaveBeenCalled();
  });

  it("changes only publication state with a strict boolean body", async () => {
    const published = await PATCH(
      request(`/api/automation/v1/pubs/${id}/publication`, "PATCH", "pubs:publish", '{"isPublished":true}'),
      context(id),
    );
    expect(published.status).toBe(200);
    expect(repositoryMocks.setAdminPubPublication).toHaveBeenCalledWith(id, true);
    await expect(published.json()).resolves.toEqual({ publication: { id, isPublished: true, unchanged: false } });

    repositoryMocks.setAdminPubPublication.mockResolvedValueOnce({ id, isPublished: false, unchanged: false });
    const unpublished = await PATCH(
      request(`/api/automation/v1/pubs/${id}/publication`, "PATCH", "pubs:publish", '{"isPublished":false}'),
      context(id),
    );
    expect(unpublished.status).toBe(200);
    expect(repositoryMocks.setAdminPubPublication).toHaveBeenLastCalledWith(id, false);

    for (const body of ['{"isPublished":"true"}', '{"isPublished":true,"id":"client-id"}']) {
      const invalid = await PATCH(
        request(`/api/automation/v1/pubs/${id}/publication`, "PATCH", "pubs:publish", body),
        context(id),
      );
      expect(invalid.status).toBe(422);
    }
    expect(repositoryMocks.setAdminPubPublication).toHaveBeenCalledTimes(2);
  });

  it("returns missing publication fields or a missing Pub with the existing contract", async () => {
    repositoryMocks.setAdminPubPublication.mockRejectedValueOnce(
      new repositoryMocks.PubPublicationValidationError(["address", "latitude"]),
    );
    const blocked = await PATCH(
      request(`/api/automation/v1/pubs/${id}/publication`, "PATCH", "pubs:publish", '{"isPublished":true}'),
      context(id),
    );
    expect(blocked.status).toBe(422);
    await expect(blocked.json()).resolves.toEqual({
      errorCode: "publication_requirements_not_met",
      missingFields: ["address", "latitude"],
    });

    repositoryMocks.setAdminPubPublication.mockResolvedValueOnce(null);
    const missing = await PATCH(
      request(`/api/automation/v1/pubs/${id}/publication`, "PATCH", "pubs:publish", '{"isPublished":true}'),
      context(id),
    );
    expect(missing.status).toBe(404);
  });

  it.each([
    ["list", "pubs:create", () => GET(request("/api/automation/v1/pubs", "GET", "pubs:create"))],
    [
      "detail",
      "pubs:update",
      () => GET_DETAIL(request(`/api/automation/v1/pubs/${id}`, "GET", "pubs:update"), context(id)),
    ],
    ["create", "pubs:read", () => POST(request("/api/automation/v1/pubs", "POST", "pubs:read", "{}"))],
    [
      "update",
      "pubs:create",
      () => PUT(request(`/api/automation/v1/pubs/${id}`, "PUT", "pubs:create", "{}"), context(id)),
    ],
    [
      "publication",
      "pubs:update",
      () =>
        PATCH(
          request(`/api/automation/v1/pubs/${id}/publication`, "PATCH", "pubs:update", '{"isPublished":true}'),
          context(id),
        ),
    ],
    [
      "publication",
      "pubs:create",
      () =>
        PATCH(
          request(`/api/automation/v1/pubs/${id}/publication`, "PATCH", "pubs:create", '{"isPublished":true}'),
          context(id),
        ),
    ],
  ])("does not inherit %s permission from %s", async (_operation, _scope, call) => {
    const response = await call();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ errorCode: "forbidden" });
  });

  it("requires a valid Bearer token and never exposes DELETE", async () => {
    const missingToken = await GET(new Request("https://example.com/api/automation/v1/pubs"));
    expect(missingToken.status).toBe(401);
    await expect(missingToken.json()).resolves.toEqual({ errorCode: "unauthorized" });
    expect(missingToken.headers.get("WWW-Authenticate")).toBe("Bearer");

    process.env.AUTOMATION_API_TOKEN_SHA256 = createHash("sha256").update("another-token").digest("hex");
    const wrongToken = await GET(request("/api/automation/v1/pubs", "GET", "pubs:read"));
    expect(wrongToken.status).toBe(401);
    expect(pubDetailRoute).not.toHaveProperty("DELETE");
  });
});
