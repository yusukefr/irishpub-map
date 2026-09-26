import { describe, expect, it } from "vitest";
import { insertMediaImageMarkdown } from "../../apps/web/app/lib/content/editor-image";

const id = "550e8400-e29b-41d4-a716-446655440009";

describe("insertMediaImageMarkdown", () => {
  it("カーソル位置または選択範囲へMedia参照を挿入する", () => {
    const inserted = insertMediaImageMarkdown("前文\n\n後文", 4, 4, id, "店内の写真");
    expect(inserted.markdown).toBe(`前文\n\n![店内の写真](/media/${id})後文`);
    expect(inserted.caret).toBe(inserted.markdown.indexOf("後文"));

    const replaced = insertMediaImageMarkdown("前文と旧画像と後文", 3, 6, id, "新しい画像");
    expect(replaced.markdown).toBe(`前文と![新しい画像](/media/${id})と後文`);
  });

  it("alt内の改行・Markdown括弧・バックスラッシュを安全な記法へ変える", () => {
    const inserted = insertMediaImageMarkdown("", 0, 0, id, " 表[裏]\\面\n写真 ");
    expect(inserted.markdown).toBe(`![表\\[裏\\]\\\\面 写真](/media/${id})`);
  });
});
