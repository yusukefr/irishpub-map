import { describe, expect, it } from "vitest";
import { isMediaAssetId } from "../../packages/shared/src/media";
import { isPubId } from "../../packages/shared/src/pub";
import { isUuid } from "../../packages/shared/src/uuid";
import { isQuizQuestionId } from "../../apps/web/app/lib/quiz/types";

describe("shared UUID validation", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts RFC 4122 version 1-5 UUIDs without regard to letter case", () => {
    expect(isUuid(validUuid)).toBe(true);
    expect(isUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects non-string values and UUIDs outside the existing version and variant contract", () => {
    expect(isUuid(null)).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("550e8400-e29b-71d4-a716-446655440000")).toBe(false);
    expect(isUuid("550e8400-e29b-41d4-c716-446655440000")).toBe(false);
  });

  it("keeps Pub, Media Asset, and Quiz Question ID checks on the shared contract", () => {
    expect(isPubId(validUuid)).toBe(true);
    expect(isPubId("bad-id")).toBe(false);
    expect(isMediaAssetId(validUuid)).toBe(true);
    expect(isMediaAssetId(null)).toBe(false);
    expect(isQuizQuestionId(validUuid)).toBe(true);
    expect(isQuizQuestionId("bad-id")).toBe(false);
  });
});
