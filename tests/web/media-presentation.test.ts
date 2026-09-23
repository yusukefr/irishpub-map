import { describe, expect, it } from "vitest";
import {
  formatMediaDate,
  formatMediaFileSize,
  formatMediaType,
  isMediaAsset,
} from "../../apps/web/app/lib/media/presentation";

describe("media presentation helpers", () => {
  it("formats MIME labels and 1024-based file sizes", () => {
    expect(formatMediaType("image/webp")).toBe("WebP");
    expect(formatMediaFileSize(512, "en")).toBe("512 B");
    expect(formatMediaFileSize(1_843_200, "en")).toBe("1.8 MB");
  });

  it("formats valid dates in the requested locale and validates MediaAsset values", () => {
    const asset = {
      id: "30000000-0000-4000-8000-000000000301",
      url: "/media-fixtures/landscape.jpg",
      mimeType: "image/jpeg",
      width: 1200,
      height: 800,
      fileSize: 184320,
      createdAt: "2026-09-20T10:00:00.000Z",
    } as const;
    expect(formatMediaDate(asset.createdAt, "en")).toContain("2026");
    expect(isMediaAsset(asset)).toBe(true);
    expect(isMediaAsset({ ...asset, mimeType: "image/svg+xml" })).toBe(false);
  });
});
