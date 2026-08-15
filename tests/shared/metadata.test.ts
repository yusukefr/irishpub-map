import { describe, expect, it } from "vitest";
import { getPrefectureCode, getPrefectureName, PREFECTURES } from "../../packages/shared/src/prefecture";
import { getPubStatusCode, getPubStatusValue, PUB_STATUS_DEFINITIONS } from "../../packages/shared/src/status";

describe("normalized metadata definitions", () => {
  it("defines all JIS prefectures in ascending code order", () => {
    expect(PREFECTURES).toHaveLength(47);
    expect(PREFECTURES.map(({ code }) => code)).toEqual(Array.from({ length: 47 }, (_, index) => index + 1));
    expect(getPrefectureCode("東京都")).toBe(13);
    expect(getPrefectureName(47)).toBe("沖縄県");
  });

  it("keeps DB status codes compatible with external status values", () => {
    expect(PUB_STATUS_DEFINITIONS.map(({ code }) => code)).toEqual([1, 2, 3, 4]);
    expect(getPubStatusCode("temporarily_closed")).toBe(2);
    expect(getPubStatusValue(3)).toBe("closed");
  });
});
