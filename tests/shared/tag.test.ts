// 既知・未知のタグが利用者向け表示名へ変換されることを保証するテストです。
import { describe, expect, it } from "vitest";
import { getTagLabel, normalizeTag, normalizeTags } from "../../packages/shared/src/tag";

describe("getTagLabel", () => {
  it("returns Japanese labels for defined tag IDs", () => {
    expect(getTagLabel("guinness")).toBe("ギネス");
    expect(getTagLabel("food")).toBe("食事あり");
    expect(getTagLabel("station-area")).toBe("駅近");
    expect(getTagLabel("craft-beer")).toBe("クラフトビール");
    expect(getTagLabel("live-music")).toBe("ライブ音楽");
  });

  it("normalizes explicit aliases and mechanical separators", () => {
    expect(normalizeTag(" WHISKY ")).toBe("whiskey");
    expect(normalizeTag("ウイスキー")).toBe("whiskey");
    expect(normalizeTags(["ギネス", "guinness", "craft_beer"])).toEqual(["guinness", "craft-beer"]);
  });

  it("uses the tag ID as a fallback for an undefined label", () => {
    expect(getTagLabel("seasonal-event")).toBe("seasonal-event");
  });
});
