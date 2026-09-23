import { describe, expect, it, vi } from "vitest";
import { E2E_TEST_DATA } from "../../apps/web/app/lib/e2e-test-fixtures";
import { getMediaAsset, insertMediaAsset, listMediaAssets } from "../../apps/web/app/lib/media/repository";

const neonMock = vi.hoisted(() => vi.fn());
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));
vi.mock("../../apps/web/app/lib/e2e-test-mode", () => ({
  isE2ETestMode: () => true,
  rejectE2ETestMutation: () => {
    throw new Error("Mutations are disabled in E2E test mode.");
  },
}));

describe("Media repository E2E mode", () => {
  it("returns fixed paginated fixtures without opening Neon", async () => {
    await expect(listMediaAssets(1)).resolves.toMatchObject({
      total: 2,
      page: 1,
      pageSize: 50,
      media: [E2E_TEST_DATA.media.landscape, E2E_TEST_DATA.media.portrait],
    });
    await expect(listMediaAssets(2)).resolves.toMatchObject({ total: 2, page: 2, media: [] });
    expect(neonMock).not.toHaveBeenCalled();
  });

  it("returns fixture details and continues to reject mutations", async () => {
    await expect(getMediaAsset(E2E_TEST_DATA.media.portrait.id)).resolves.toEqual(E2E_TEST_DATA.media.portrait);
    await expect(getMediaAsset("missing")).resolves.toBeNull();
    await expect(
      insertMediaAsset({
        id: E2E_TEST_DATA.media.portrait.id,
        storageKey: "media/test.webp",
        url: E2E_TEST_DATA.media.portrait.url,
        mimeType: "image/webp",
        width: 1,
        height: 1,
        fileSize: 1,
      }),
    ).rejects.toThrow("Mutations are disabled in E2E test mode.");
    expect(neonMock).not.toHaveBeenCalled();
  });
});
