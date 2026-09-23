import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "../../apps/web/app/lib/admin-auth";

const repository = vi.hoisted(() => ({
  getMediaAsset: vi.fn(),
  isMediaDatabaseConfigured: vi.fn(),
  listMediaAssets: vi.fn(),
}));
const storage = vi.hoisted(() => ({ isMediaStorageConfigured: vi.fn() }));
const service = vi.hoisted(() => ({
  MediaUploadServiceError: class MediaUploadServiceError extends Error {},
  uploadAdminMedia: vi.fn(),
}));
vi.mock("../../apps/web/app/lib/media/repository", () => repository);
vi.mock("../../apps/web/app/lib/media/storage", () => storage);
vi.mock("../../apps/web/app/lib/media/service", () => service);
vi.mock("../../apps/web/app/lib/media/validation", () => ({
  MediaValidationError: class MediaValidationError extends Error {},
}));

import { GET as GET_DETAIL } from "../../apps/web/app/api/admin/media/[id]/route";
import { GET, POST } from "../../apps/web/app/api/admin/media/route";

const original = {
  secret: process.env.ADMIN_SESSION_SECRET,
  username: process.env.ADMIN_USERNAME,
  hash: process.env.ADMIN_PASSWORD_HASH,
};
beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "test-session-secret";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD_HASH = "test-hash";
  repository.isMediaDatabaseConfigured.mockReset().mockReturnValue(true);
  repository.listMediaAssets.mockReset().mockResolvedValue({ media: [], total: 0, page: 1, pageSize: 50 });
  repository.getMediaAsset.mockReset();
  storage.isMediaStorageConfigured.mockReset().mockReturnValue(true);
  service.uploadAdminMedia.mockReset();
});
afterEach(() => {
  for (const [key, value] of Object.entries({
    ADMIN_SESSION_SECRET: original.secret,
    ADMIN_USERNAME: original.username,
    ADMIN_PASSWORD_HASH: original.hash,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function request(path: string, method = "GET", body?: BodyInit, contentType?: string) {
  const headers = new Headers({ cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession("admin")}` });
  if (method !== "GET") headers.set("origin", "http://localhost");
  if (contentType) headers.set("content-type", contentType);
  return new Request(`http://localhost${path}`, { method, headers, body });
}

describe("admin media API", () => {
  it("requires an administrator and reports an empty list when DB is not configured", async () => {
    expect((await GET(new Request("http://localhost/api/admin/media"))).status).toBe(401);
    repository.isMediaDatabaseConfigured.mockReturnValue(false);
    const response = await GET(request("/api/admin/media"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      media: [],
      databaseConfigured: false,
      storageConfigured: true,
    });
    expect(repository.listMediaAssets).not.toHaveBeenCalled();
  });

  it("rejects invalid query parameters and returns fixed-page metadata", async () => {
    expect((await GET(request("/api/admin/media?extra=1"))).status).toBe(400);
    const response = await GET(request("/api/admin/media?page=2"));
    expect(response.status).toBe(200);
    expect(repository.listMediaAssets).toHaveBeenCalledWith(2);
    await expect(response.json()).resolves.toMatchObject({
      databaseConfigured: true,
      storageConfigured: true,
      pageSize: 50,
    });
  });

  it("validates origin, multipart shape, storage configuration, and detail UUID", async () => {
    const denied = new Request("http://localhost/api/admin/media", {
      method: "POST",
      headers: {
        cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession("admin")}`,
        origin: "https://evil.example",
        "content-type": "multipart/form-data; boundary=x",
      },
      body: "",
    });
    expect((await POST(denied)).status).toBe(403);
    expect((await POST(request("/api/admin/media", "POST", "{}", "application/json"))).status).toBe(415);
    storage.isMediaStorageConfigured.mockReturnValue(false);
    expect((await POST(request("/api/admin/media", "POST", "", "multipart/form-data; boundary=x"))).status).toBe(503);
    expect(
      (await GET_DETAIL(request("/api/admin/media/nope"), { params: Promise.resolve({ id: "nope" }) })).status,
    ).toBe(400);
  });
});
