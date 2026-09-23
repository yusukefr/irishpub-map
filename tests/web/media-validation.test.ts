import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MediaValidationError, validateMediaFile } from "../../apps/web/app/lib/media/validation";

async function imageFile(format: "jpeg" | "png" | "webp" = "png") {
  const buffer = await sharp({ create: { width: 8, height: 6, channels: 3, background: "#176b57" } })
    .toFormat(format)
    .toBuffer();
  return new File([buffer], `sample.${format}`, { type: `image/${format}` });
}

describe("media upload validation", () => {
  it("uses decoded image format and dimensions", async () => {
    await expect(validateMediaFile(await imageFile())).resolves.toMatchObject({
      mimeType: "image/png",
      width: 8,
      height: 6,
    });
  });

  it("rejects claimed MIME and extension that do not match image bytes", async () => {
    const valid = await imageFile();
    await expect(
      validateMediaFile(new File([await valid.arrayBuffer()], "spoof.jpg", { type: "image/jpeg" })),
    ).rejects.toMatchObject({ kind: "unsupported" });
  });

  it("rejects empty, corrupt, and unsupported files", async () => {
    await expect(validateMediaFile(new File([], "empty.png", { type: "image/png" }))).rejects.toMatchObject({
      kind: "invalid",
    });
    await expect(validateMediaFile(new File(["not an image"], "bad.png", { type: "image/png" }))).rejects.toMatchObject(
      { kind: "invalid" },
    );
    await expect(validateMediaFile(new File(["GIF89a"], "bad.gif", { type: "image/gif" }))).rejects.toMatchObject({
      kind: "invalid",
    });
  });

  it("enforces the upload size before decoding", async () => {
    const oversized = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
    await expect(validateMediaFile(oversized)).rejects.toBeInstanceOf(MediaValidationError);
    await expect(validateMediaFile(oversized)).rejects.toMatchObject({ kind: "too_large" });
  });
});
