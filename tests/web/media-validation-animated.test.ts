import { describe, expect, it, vi } from "vitest";

const sharpMock = vi.hoisted(() => vi.fn());
vi.mock("sharp", () => ({
  default: sharpMock,
}));

import { validateMediaFile } from "../../apps/web/app/lib/media/validation";

describe("animated media validation", () => {
  it("rejects multi-frame WebP after decoding its metadata", async () => {
    sharpMock.mockReturnValue({
      metadata: async () => ({ format: "webp", pages: 2, width: 2, height: 2 }),
    });
    const file = new File(["webp bytes"], "animated.webp", { type: "image/webp" });

    await expect(validateMediaFile(file)).rejects.toMatchObject({ kind: "unsupported" });
    expect(sharpMock).toHaveBeenCalledWith(expect.any(Buffer), { animated: true });
  });
});
