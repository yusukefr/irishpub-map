import { describe, expect, it } from "vitest";
import { getAdminMediaApiErrorMessage } from "../../apps/web/app/lib/admin-api-client";

describe("admin media API error translation", () => {
  it.each([
    ["media_file_too_large", "ファイルサイズは4 MiB以下にしてください。"],
    ["media_unsupported_format", "JPEG、PNG、WebP形式の画像を選択してください。"],
    ["media_invalid_image", "画像を読み取れませんでした。別のファイルをお試しください。"],
    ["media_dimensions_exceeded", "画像の幅、高さ、または画素数が上限を超えています。"],
    ["media_storage_unavailable", "画像ストレージを利用できません。"],
    ["database_unavailable", "Mediaデータベースを利用できません。"],
  ])("translates %s safely", (errorCode, expected) => {
    expect(getAdminMediaApiErrorMessage("ja", { errorCode, providerMessage: "secret" })).toBe(expected);
  });

  it("falls back to the shared safe translation for unknown errors", () => {
    expect(getAdminMediaApiErrorMessage("en", { errorCode: "unknown", message: "secret" })).toBe(
      "An unexpected error occurred.",
    );
  });
});
