import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({ insertMediaAsset: vi.fn() }));
const storage = vi.hoisted(() => ({ deleteMediaBlob: vi.fn(), uploadMediaBlob: vi.fn() }));
const validation = vi.hoisted(() => ({ validateMediaFile: vi.fn() }));
vi.mock("../../apps/web/app/lib/media/repository", () => repository);
vi.mock("../../apps/web/app/lib/media/storage", () => storage);
vi.mock("../../apps/web/app/lib/media/validation", () => validation);

import { uploadAdminMedia } from "../../apps/web/app/lib/media/service";

const original = { e2e: process.env.E2E_TEST_MODE, vercel: process.env.VERCEL_ENV };
beforeEach(() => {
  delete process.env.E2E_TEST_MODE;
  delete process.env.VERCEL_ENV;
  validation.validateMediaFile.mockReset().mockResolvedValue({
    buffer: Buffer.from("image"),
    mimeType: "image/png",
    extension: "png",
    width: 1,
    height: 1,
    fileSize: 5,
  });
  storage.uploadMediaBlob.mockReset().mockResolvedValue({ url: "https://blob.example/media.png" });
  storage.deleteMediaBlob.mockReset().mockResolvedValue(undefined);
  repository.insertMediaAsset.mockReset().mockResolvedValue({ id: "asset" });
});
afterEach(() => {
  if (original.e2e === undefined) delete process.env.E2E_TEST_MODE;
  else process.env.E2E_TEST_MODE = original.e2e;
  if (original.vercel === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = original.vercel;
});

describe("media upload service", () => {
  it("compensates a Blob upload when database insert fails", async () => {
    repository.insertMediaAsset.mockRejectedValue(new Error("private database detail"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(uploadAdminMedia(new File(["image"], "image.png", { type: "image/png" }))).rejects.toMatchObject({
      kind: "database_failed",
    });
    expect(storage.deleteMediaBlob).toHaveBeenCalledWith("https://blob.example/media.png");
    expect(error.mock.calls.flat().join(" ")).not.toContain("private database detail");
    error.mockRestore();
  });

  it("rejects E2E mutation mode before upload or database mutation", async () => {
    process.env.E2E_TEST_MODE = "1";
    await expect(uploadAdminMedia(new File(["image"], "image.png", { type: "image/png" }))).rejects.toThrow();
    expect(storage.uploadMediaBlob).not.toHaveBeenCalled();
    expect(repository.insertMediaAsset).not.toHaveBeenCalled();
  });
});
