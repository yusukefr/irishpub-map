import { afterEach, describe, expect, it, vi } from "vitest";
import { deleteMediaBlob, isMediaStorageConfigured, uploadMediaBlob } from "../../apps/web/app/lib/media/storage";

const blobMock = vi.hoisted(() => ({ del: vi.fn(), put: vi.fn() }));
vi.mock("@vercel/blob", () => blobMock);

const originalStorageEnvironment = {
  readWriteToken: process.env.BLOB_READ_WRITE_TOKEN,
  storeId: process.env.BLOB_STORE_ID,
  oidcToken: process.env.VERCEL_OIDC_TOKEN,
};

afterEach(() => {
  vi.clearAllMocks();
  for (const [key, value] of Object.entries({
    BLOB_READ_WRITE_TOKEN: originalStorageEnvironment.readWriteToken,
    BLOB_STORE_ID: originalStorageEnvironment.storeId,
    VERCEL_OIDC_TOKEN: originalStorageEnvironment.oidcToken,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("media storage", () => {
  it.each([
    { readWriteToken: "token", storeId: undefined, oidcToken: undefined, configured: true },
    { readWriteToken: undefined, storeId: "store", oidcToken: undefined, configured: true },
    { readWriteToken: undefined, storeId: "store", oidcToken: "oidc", configured: true },
    { readWriteToken: undefined, storeId: undefined, oidcToken: "oidc", configured: false },
    { readWriteToken: undefined, storeId: undefined, oidcToken: undefined, configured: false },
  ])(
    "checks storage configuration from token or store ID ($configured)",
    ({ readWriteToken, storeId, oidcToken, configured }) => {
      if (readWriteToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
      else process.env.BLOB_READ_WRITE_TOKEN = readWriteToken;
      if (storeId === undefined) delete process.env.BLOB_STORE_ID;
      else process.env.BLOB_STORE_ID = storeId;
      if (oidcToken === undefined) delete process.env.VERCEL_OIDC_TOKEN;
      else process.env.VERCEL_OIDC_TOKEN = oidcToken;

      expect(isMediaStorageConfigured()).toBe(configured);
    },
  );

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
