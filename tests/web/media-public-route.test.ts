import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMediaAsset: vi.fn(),
  isMediaDatabaseConfigured: vi.fn(),
  isE2ETestMode: vi.fn(),
}));
vi.mock("../../apps/web/app/lib/media/repository", () => ({
  getMediaAsset: mocks.getMediaAsset,
  isMediaDatabaseConfigured: mocks.isMediaDatabaseConfigured,
}));
vi.mock("../../apps/web/app/lib/e2e-test-mode", () => ({ isE2ETestMode: mocks.isE2ETestMode }));

import { GET } from "../../apps/web/app/media/[id]/route";

const id = "550e8400-e29b-41d4-a716-446655440009";
const asset = {
  id,
  url: "https://example.public.blob.vercel-storage.com/photo.webp",
  mimeType: "image/webp",
  width: 1200,
  height: 800,
  fileSize: 1024,
  createdAt: "2026-09-20T00:00:00.000Z",
};
const request = new Request(`https://example.test/media/${id}`);
const context = (value: string) => ({ params: Promise.resolve({ id: value }) });

beforeEach(() => {
  mocks.getMediaAsset.mockReset().mockResolvedValue(asset);
  mocks.isMediaDatabaseConfigured.mockReset().mockReturnValue(true);
  mocks.isE2ETestMode.mockReset().mockReturnValue(false);
});

describe("public Media URL", () => {
  it("登録済み画像をBlobへ一時redirectし、画像バイナリをproxyしない", async () => {
    const response = await GET(request, context(id));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(asset.url);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300, s-maxage=300");
    expect(mocks.getMediaAsset).toHaveBeenCalledWith(id);
  });

  it("不正ID・未登録ID・許可外の転送先を公開しない", async () => {
    expect((await GET(request, context("not-a-uuid"))).status).toBe(404);
    expect(mocks.getMediaAsset).not.toHaveBeenCalled();
    mocks.getMediaAsset.mockResolvedValueOnce(null);
    expect((await GET(request, context(id))).status).toBe(404);
    mocks.getMediaAsset.mockResolvedValueOnce({ ...asset, url: "https://other.example/photo.webp" });
    expect((await GET(request, context(id))).status).toBe(404);
  });

  it("DB未設定・取得障害を503にし、E2E fixtureだけはローカルへ解決する", async () => {
    mocks.isMediaDatabaseConfigured.mockReturnValue(false);
    expect((await GET(request, context(id))).status).toBe(503);
    mocks.isE2ETestMode.mockReturnValue(true);
    mocks.getMediaAsset.mockResolvedValueOnce({ ...asset, url: "/media-fixtures/landscape.jpg" });
    const fixtureResponse = await GET(request, context(id));
    expect(fixtureResponse.status).toBe(307);
    expect(fixtureResponse.headers.get("location")).toBe("https://example.test/media-fixtures/landscape.jpg");
    mocks.getMediaAsset.mockRejectedValueOnce(new Error("Database error"));
    expect((await GET(request, context(id))).status).toBe(503);
  });
});
