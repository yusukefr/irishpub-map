import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteMediaBlob, uploadMediaBlob } from "../../apps/web/app/lib/media/storage";

const blobMock = vi.hoisted(() => ({ del: vi.fn(), put: vi.fn() }));
vi.mock("@vercel/blob", () => blobMock);

afterEach(() => vi.clearAllMocks());

describe("media storage", () => {
  it("uploads a public blob with stable, non-overwriting options", async () => {
    const body = Buffer.from("png bytes");
    await uploadMediaBlob("media/asset.png", body, "image/png");
    expect(blobMock.put).toHaveBeenCalledWith("media/asset.png", body, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  });

  it("deletes a blob by its URL", async () => {
    await deleteMediaBlob("https://blob.example/asset.png");
    expect(blobMock.del).toHaveBeenCalledWith("https://blob.example/asset.png");
  });
});
