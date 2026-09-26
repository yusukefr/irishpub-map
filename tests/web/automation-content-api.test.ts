// 各Content操作のScope分離、HTTP契約、既存Serviceへの委譲を確認します。
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({ isContentDatabaseConfigured: vi.fn() }));
vi.mock("../../apps/web/app/lib/admin-content-repository", () => repositoryMocks);

const serviceMocks = vi.hoisted(() => {
  class AdminContentServiceError extends Error {
    constructor(
      readonly code: "validation" | "conflict" | "not_found" | "publication_requirements_not_met",
      readonly fieldErrors: Record<string, string> = {},
      readonly missingFields: string[] = [],
    ) {
      super(code);
    }
  }
  return {
    AdminContentServiceError,
    changeAdminContentPublication: vi.fn(),
    createAdminContent: vi.fn(),
    readAdminContent: vi.fn(),
    readAdminContentList: vi.fn(),
    updateAdminContent: vi.fn(),
  };
});
vi.mock("../../apps/web/app/lib/admin-content-service", () => serviceMocks);

import { GET as getDetail, PUT } from "../../apps/web/app/api/automation/v1/content/[id]/route";
import { PATCH } from "../../apps/web/app/api/automation/v1/content/[id]/publication/route";
import { GET as getList, POST } from "../../apps/web/app/api/automation/v1/content/route";

const token = "test-only-automation-token";
const id = "550e8400-e29b-41d4-a716-446655440001";
const originalHash = process.env.AUTOMATION_API_TOKEN_SHA256;
const originalScopes = process.env.AUTOMATION_API_SCOPES;
const originalDatabaseUrl = process.env.DATABASE_URL;
const input = { kind: "guide", slug: "pub-etiquette", category: "pub-culture", translations: { ja: {}, en: {} } };

beforeEach(() => {
  process.env.AUTOMATION_API_TOKEN_SHA256 = createHash("sha256").update(token).digest("hex");
  process.env.AUTOMATION_API_SCOPES = "content:read,content:create,content:update,content:publish";
  process.env.DATABASE_URL = "postgres://test-only";
  vi.resetAllMocks();
  repositoryMocks.isContentDatabaseConfigured.mockReturnValue(true);
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

function request(
  path: string,
  method = "GET",
  body?: string,
  bearer: string | null = token,
  contentType = "application/json",
) {
  return new Request("https://example.com/api/automation/v1/content" + path, {
    method,
    headers: {
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      ...(body === undefined ? {} : { "content-type": contentType }),
    },
    body,
  });
}

function context(contentId = id) {
  return { params: Promise.resolve({ id: contentId }) };
}

describe("automation content API", () => {
  it("requires Bearer authentication on every operation", async () => {
    for (const bearer of [null, "invalid"]) {
      const responses = await Promise.all([
        getList(request("", "GET", undefined, bearer)),
        getDetail(request("/" + id, "GET", undefined, bearer), context()),
        POST(request("", "POST", "{}", bearer)),
        PUT(request("/" + id, "PUT", "{}", bearer), context()),
        PATCH(request("/" + id + "/publication", "PATCH", "{}", bearer), context()),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(401);
        expect(response.headers.get("www-authenticate")).toBe("Bearer");
        await expect(response.json()).resolves.toEqual({ errorCode: "unauthorized" });
      }
    }
    expect(serviceMocks.readAdminContentList).not.toHaveBeenCalled();
    expect(serviceMocks.createAdminContent).not.toHaveBeenCalled();
  });

  it.each([
    ["content:read", [200, 200, 403, 403, 403]],
    ["content:create", [403, 403, 201, 403, 403]],
    ["content:update", [403, 403, 403, 200, 403]],
    ["content:publish", [403, 403, 403, 403, 200]],
  ])("allows only the %s operation", async (scope, statuses) => {
    process.env.AUTOMATION_API_SCOPES = scope;
    serviceMocks.readAdminContentList.mockResolvedValue([]);
    serviceMocks.readAdminContent.mockResolvedValue({ id, status: "draft" });
    serviceMocks.createAdminContent.mockResolvedValue({ id, status: "draft" });
    serviceMocks.updateAdminContent.mockResolvedValue({ id, status: "draft" });
    serviceMocks.changeAdminContentPublication.mockResolvedValue({ id, status: "published" });
    const responses = await Promise.all([
      getList(request("")),
      getDetail(request("/" + id), context()),
      POST(request("", "POST", JSON.stringify(input))),
      PUT(request("/" + id, "PUT", JSON.stringify(input)), context()),
      PATCH(request("/" + id + "/publication", "PATCH", '{"status":"published"}'), context()),
    ]);
    expect(responses.map((response) => response.status)).toEqual(statuses);
    for (const response of responses.filter((item) => item.status === 403)) {
      await expect(response.json()).resolves.toEqual({ errorCode: "forbidden" });
    }
  });

  it("reads Draft and Published entries and returns a 404 for missing detail", async () => {
    serviceMocks.readAdminContentList.mockResolvedValue([
      { id, status: "draft" },
      { id: id.replace(/1$/, "2"), status: "published" },
    ]);
    const list = await getList(request(""));
    await expect(list.json()).resolves.toEqual({
      content: [
        { id, status: "draft" },
        { id: id.replace(/1$/, "2"), status: "published" },
      ],
      databaseConfigured: true,
    });

    serviceMocks.readAdminContent.mockResolvedValueOnce({ id, status: "draft" });
    const detail = await getDetail(request("/" + id), context());
    await expect(detail.json()).resolves.toEqual({ content: { id, status: "draft" } });

    serviceMocks.readAdminContent.mockRejectedValueOnce(new serviceMocks.AdminContentServiceError("not_found"));
    const missing = await getDetail(request("/" + id), context());
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ errorCode: "content_not_found" });
  });

  it("creates through the existing Draft service and rejects invalid transport input", async () => {
    serviceMocks.createAdminContent.mockResolvedValue({ id, status: "draft", publishedAt: null });
    const created = await POST(request("", "POST", JSON.stringify(input)));
    expect(created.status).toBe(201);
    expect(serviceMocks.createAdminContent).toHaveBeenCalledWith(input);
    await expect(created.json()).resolves.toEqual({ content: { id, status: "draft", publishedAt: null } });

    expect((await POST(request("", "POST", "{}", token, "text/plain"))).status).toBe(415);
    expect((await POST(request("", "POST", "{"))).status).toBe(400);
    expect(serviceMocks.createAdminContent).toHaveBeenCalledTimes(1);
  });

  it("maps validation and slug conflict without exposing internal errors", async () => {
    serviceMocks.createAdminContent.mockRejectedValueOnce(
      new serviceMocks.AdminContentServiceError("validation", { status: "immutable" }),
    );
    const invalid = await POST(request("", "POST", JSON.stringify({ ...input, status: "published" })));
    expect(invalid.status).toBe(422);
    await expect(invalid.json()).resolves.toEqual({
      errorCode: "validation_error",
      fieldErrors: { status: "immutable" },
    });

    serviceMocks.createAdminContent.mockRejectedValueOnce(
      new serviceMocks.AdminContentServiceError("conflict", { slug: "invalid_format" }),
    );
    const conflict = await POST(request("", "POST", JSON.stringify(input)));
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({
      errorCode: "content_conflict",
      fieldErrors: { slug: "invalid_format" },
    });

    serviceMocks.createAdminContent.mockRejectedValueOnce(new Error("database detail"));
    const failure = await POST(request("", "POST", JSON.stringify(input)));
    expect(failure.status).toBe(500);
    await expect(failure.json()).resolves.toEqual({ errorCode: "internal_error" });
  });

  it("updates a full snapshot through the existing service and preserves its publication result", async () => {
    serviceMocks.updateAdminContent.mockResolvedValue({
      id,
      status: "published",
      publishedAt: "2026-09-11T01:00:00.000Z",
    });
    const updated = await PUT(request("/" + id, "PUT", JSON.stringify(input)), context());
    expect(serviceMocks.updateAdminContent).toHaveBeenCalledWith(id, input);
    await expect(updated.json()).resolves.toEqual({
      content: { id, status: "published", publishedAt: "2026-09-11T01:00:00.000Z" },
    });

    serviceMocks.updateAdminContent.mockRejectedValueOnce(
      new serviceMocks.AdminContentServiceError("publication_requirements_not_met", {}, ["translations.en.title"]),
    );
    const blocked = await PUT(request("/" + id, "PUT", JSON.stringify(input)), context());
    expect(blocked.status).toBe(422);
    await expect(blocked.json()).resolves.toEqual({
      errorCode: "publication_requirements_not_met",
      missingFields: ["translations.en.title"],
    });

    serviceMocks.updateAdminContent.mockRejectedValueOnce(new serviceMocks.AdminContentServiceError("not_found"));
    expect((await PUT(request("/" + id, "PUT", JSON.stringify(input)), context())).status).toBe(404);
  });

  it("publishes and reverts through the existing service with strict status input", async () => {
    serviceMocks.changeAdminContentPublication.mockResolvedValueOnce({
      id,
      status: "published",
      unchanged: false,
      publishedAt: "2026-09-11T02:30:00.000Z",
    });
    const published = await PATCH(request("/" + id + "/publication", "PATCH", '{"status":"published"}'), context());
    expect(serviceMocks.changeAdminContentPublication).toHaveBeenCalledWith(id, "published");
    await expect(published.json()).resolves.toEqual({
      publication: { id, status: "published", unchanged: false, publishedAt: "2026-09-11T02:30:00.000Z" },
    });

    serviceMocks.changeAdminContentPublication.mockResolvedValueOnce({
      id,
      status: "draft",
      unchanged: false,
      publishedAt: null,
    });
    const draft = await PATCH(request("/" + id + "/publication", "PATCH", '{"status":"draft"}'), context());
    expect(draft.status).toBe(200);
    await expect(draft.json()).resolves.toMatchObject({ publication: { status: "draft", publishedAt: null } });

    for (const body of ['{"status":"public"}', '{"status":"published","publishedAt":"2026-01-01"}']) {
      const invalid = await PATCH(request("/" + id + "/publication", "PATCH", body), context());
      expect(invalid.status).toBe(422);
      await expect(invalid.json()).resolves.toEqual({ errorCode: "validation_error" });
    }
    expect(serviceMocks.changeAdminContentPublication).toHaveBeenCalledTimes(2);

    serviceMocks.changeAdminContentPublication.mockRejectedValueOnce(
      new serviceMocks.AdminContentServiceError("publication_requirements_not_met", {}, ["translations.en.title"]),
    );
    const blocked = await PATCH(request("/" + id + "/publication", "PATCH", '{"status":"published"}'), context());
    expect(blocked.status).toBe(422);
    await expect(blocked.json()).resolves.toEqual({
      errorCode: "publication_requirements_not_met",
      missingFields: ["translations.en.title"],
    });
  });

  it("validates IDs and keeps database-unavailable writes at 503", async () => {
    expect((await getDetail(request("/bad"), context("bad"))).status).toBe(400);
    expect((await PUT(request("/bad", "PUT", "{}"), context("bad"))).status).toBe(400);
    expect((await PATCH(request("/bad/publication", "PATCH", "{}"), context("bad"))).status).toBe(400);
    repositoryMocks.isContentDatabaseConfigured.mockReturnValue(false);
    for (const response of await Promise.all([
      POST(request("", "POST", "{}")),
      PUT(request("/" + id, "PUT", "{}"), context()),
      PATCH(request("/" + id + "/publication", "PATCH", "{}"), context()),
    ])) {
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ errorCode: "database_unavailable" });
    }
    expect(serviceMocks.createAdminContent).not.toHaveBeenCalled();
    expect(serviceMocks.updateAdminContent).not.toHaveBeenCalled();
    expect(serviceMocks.changeAdminContentPublication).not.toHaveBeenCalled();
  });
});
