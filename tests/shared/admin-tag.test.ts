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
      parseCreateAdminTagInput({ key: "craft-beer", translations: { ja: "  クラフトビール  ", en: " Craft Beer " } }),
    ).toEqual({
      key: "craft-beer",
      translations: { ja: "クラフトビール", en: "Craft Beer" },
    });
    expect(
      parseCreateAdminTagInput({ key: "food", translations: { ja: "食事あり", en: "   " } }).translations.en,
    ).toBeUndefined();
  });

  it.each([" whiskey", "whiskey ", "Whiskey", "live--music", "ライブ音楽", "-food", "food-"])(
    "rejects an incompatible internal key: %s",
    (key) => {
      expect(() => parseCreateAdminTagInput({ key, translations: { ja: "表示名" } })).toThrow(AdminTagValidationError);
    },
  );

  it("rejects missing and overlong values with field errors", () => {
    try {
      parseCreateAdminTagInput({
        key: "a".repeat(ADMIN_TAG_KEY_MAX_LENGTH + 1),
        translations: { ja: "あ".repeat(ADMIN_TAG_NAME_MAX_LENGTH + 1) },
      });
      expect.fail("Validation should reject overlong values.");
    } catch (error) {
      expect(error).toBeInstanceOf(AdminTagValidationError);
      expect((error as AdminTagValidationError).fieldErrors).toMatchObject({
        key: "too_long",
        "translations.ja": "too_long",
      });
    }
  });

  it("validates optional translations by locale", () => {
    expect(() => parseCreateAdminTagInput({ key: "food", translations: { ja: "食事あり", en: 1 } })).toThrow(
      expect.objectContaining({ fieldErrors: { "translations.en": "invalid_type" } }),
    );
    expect(() =>
      parseCreateAdminTagInput({
        key: "food",
        translations: { ja: "食事あり", en: "a".repeat(ADMIN_TAG_NAME_MAX_LENGTH + 1) },
      }),
    ).toThrow(expect.objectContaining({ fieldErrors: { "translations.en": "too_long" } }));
  });

  it("allows adding or removing English later without accepting a key change", () => {
    expect(parseUpdateAdminTagInput({ translations: { ja: "ウイスキー", en: "Whiskey" } })).toEqual({
      translations: { ja: "ウイスキー", en: "Whiskey" },
    });
    expect(parseUpdateAdminTagInput({ translations: { ja: "ウイスキー", en: "" } }).translations.en).toBeUndefined();
    expect(() => parseUpdateAdminTagInput({ key: "new-key", translations: { ja: "表示名" } })).toThrow(
      AdminTagValidationError,
    );
  });
});
