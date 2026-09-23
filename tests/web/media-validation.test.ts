import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MediaValidationError, validateMediaFile } from "../../apps/web/app/lib/media/validation";

async function imageFile(format: "jpeg" | "png" | "webp" = "png") {
  const buffer = await sharp({ create: { width: 8, height: 6, channels: 3, background: "#176b57" } })
    .toFormat(format)
    .toBuffer();
  return new File([buffer], `sample.${format}`, { type: `image/${format}` });
}

function pngWithDimensions(png: Buffer, width: number, height: number) {
  const image = Buffer.from(png);
  image.writeUInt32BE(width, 16);
  image.writeUInt32BE(height, 20);
  let crc = 0xffffffff;
  for (const byte of image.subarray(12, 29)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  image.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 29);
  return image;
}

function pngFile(buffer: Buffer) {
  return new File([buffer], "sample.png", { type: "image/png" });
}

describe("media upload validation", () => {
  it("uses decoded image format and dimensions", async () => {
    await expect(validateMediaFile(await imageFile())).resolves.toMatchObject({
      mimeType: "image/png",
      width: 8,
      height: 6,
    });
  });

  it.each(["jpeg", "webp"] as const)("accepts valid %s files", async (format) => {
    await expect(validateMediaFile(await imageFile(format))).resolves.toMatchObject({
      mimeType: `image/${format}`,
      width: 8,
      height: 6,
    });
  });

  it("stores dimensions after applying JPEG EXIF orientation", async () => {
    const bytes = await sharp({ create: { width: 8, height: 6, channels: 3, background: "#176b57" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    await expect(validateMediaFile(new File([bytes], "rotated.jpg", { type: "image/jpeg" }))).resolves.toMatchObject({
      width: 6,
      height: 8,
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

  it.each([
    [
      "SVG",
      new File(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'], "sample.svg", {
        type: "image/svg+xml",
      }),
    ],
  ])("rejects %s uploads", async (_name, file) => {
    await expect(validateMediaFile(file)).rejects.toBeInstanceOf(MediaValidationError);
  });

  it("rejects a valid single-frame GIF as an unsupported format", async () => {
    const validGif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    await expect(sharp(validGif, { animated: true }).metadata()).resolves.toMatchObject({
      format: "gif",
      width: 1,
      height: 1,
      pages: 1,
    });
    await expect(validateMediaFile(new File([validGif], "sample.gif", { type: "image/gif" }))).rejects.toMatchObject({
      kind: "unsupported",
    });
  });

  it("rejects AVIF uploads", async () => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#176b57" } })
      .avif()
      .toBuffer();
    await expect(validateMediaFile(new File([bytes], "sample.avif", { type: "image/avif" }))).rejects.toMatchObject({
      kind: "unsupported",
    });
  });

  it("rejects dimensions over either configured limit", async () => {
    const png = await sharp({ create: { width: 8, height: 6, channels: 3, background: "#176b57" } })
      .png()
      .toBuffer();
    await expect(validateMediaFile(pngFile(pngWithDimensions(png, 8193, 1)))).rejects.toMatchObject({
      kind: "dimensions",
    });
    await expect(validateMediaFile(pngFile(pngWithDimensions(png, 8000, 5001)))).rejects.toMatchObject({
      kind: "dimensions",
    });
  });

  it("enforces the upload size before decoding", async () => {
    const oversized = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
    await expect(validateMediaFile(oversized)).rejects.toBeInstanceOf(MediaValidationError);
    await expect(validateMediaFile(oversized)).rejects.toMatchObject({ kind: "too_large" });
  });
});
