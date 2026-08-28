import { describe, expect, it } from "vitest";
import {
  ADMIN_TAG_KEY_MAX_LENGTH,
  ADMIN_TAG_NAME_MAX_LENGTH,
  AdminTagValidationError,
  parseCreateAdminTagInput,
  parseUpdateAdminTagInput,
} from "../../packages/shared/src/admin-tag";

describe("admin tag validation", () => {
  it("normalizes display names while preserving a valid internal key", () => {
    expect(
      parseCreateAdminTagInput({ key: "craft-beer", nameJa: "  クラフトビール  ", nameEn: " Craft Beer " }),
    ).toEqual({
      key: "craft-beer",
      nameJa: "クラフトビール",
      nameEn: "Craft Beer",
    });
    expect(parseCreateAdminTagInput({ key: "food", nameJa: "食事あり", nameEn: "   " }).nameEn).toBeNull();
  });

  it.each([" whiskey", "whiskey ", "Whiskey", "live--music", "ライブ音楽", "-food", "food-"])(
    "rejects an incompatible internal key: %s",
    (key) => {
      expect(() => parseCreateAdminTagInput({ key, nameJa: "表示名" })).toThrow(AdminTagValidationError);
    },
  );

  it("rejects missing and overlong values with field errors", () => {
    try {
      parseCreateAdminTagInput({
        key: "a".repeat(ADMIN_TAG_KEY_MAX_LENGTH + 1),
        nameJa: "あ".repeat(ADMIN_TAG_NAME_MAX_LENGTH + 1),
      });
      expect.fail("Validation should reject overlong values.");
    } catch (error) {
      expect(error).toBeInstanceOf(AdminTagValidationError);
      expect((error as AdminTagValidationError).fieldErrors).toMatchObject({
        key: "too_long",
        nameJa: "too_long",
      });
    }
  });

  it("allows adding or removing English later without accepting a key change", () => {
    expect(parseUpdateAdminTagInput({ nameJa: "ウイスキー", nameEn: "Whiskey" })).toEqual({
      nameJa: "ウイスキー",
      nameEn: "Whiskey",
    });
    expect(parseUpdateAdminTagInput({ nameJa: "ウイスキー", nameEn: "" }).nameEn).toBeNull();
    expect(() => parseUpdateAdminTagInput({ key: "new-key", nameJa: "表示名" })).toThrow(AdminTagValidationError);
  });
});
