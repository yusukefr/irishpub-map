import { describe, expect, it } from "vitest";
import {
  AdminContentPublicationValidationError,
  AdminContentWriteValidationError,
  parseAdminContentWriteInput,
  parseSetAdminContentPublicationInput,
} from "../../packages/shared/src/admin-content";

const draft = {
  kind: null,
  slug: null,
  category: null,
  heroImageAssetId: null,
  translations: {
    ja: { title: "", summary: "", bodyMarkdown: "", heroImageAlt: "", heroImageCaption: "" },
    en: { title: "", summary: "", bodyMarkdown: "", heroImageAlt: "", heroImageCaption: "" },
  },
};

describe("admin content input", () => {
  it("accepts and normalizes an incomplete draft", () => {
    expect(
      parseAdminContentWriteInput({
        ...draft,
        kind: "guide",
        slug: "  pub-etiquette  ",
        category: "pub-culture",
        translations: {
          ja: {
            title: "  パブの作法  ",
            summary: "",
            bodyMarkdown: "    const value = 1;\n",
            heroImageAlt: "",
            heroImageCaption: "",
          },
          en: { ...draft.translations.en },
        },
      }),
    ).toEqual({
      kind: "guide",
      slug: "pub-etiquette",
      category: "pub-culture",
      heroImageAssetId: null,
      translations: {
        ja: {
          title: "パブの作法",
          summary: "",
          bodyMarkdown: "    const value = 1;\n",
          heroImageAlt: "",
          heroImageCaption: "",
        },
        en: { ...draft.translations.en },
      },
    });
    expect(parseAdminContentWriteInput(draft)).toEqual(draft);
  });

  it("rejects unsupported allow-list values, malformed slugs, locales, and extra fields", () => {
    expect(() =>
      parseAdminContentWriteInput({
        ...draft,
        kind: "news",
        slug: "Not Valid",
        category: "other",
        translations: { ...draft.translations, fr: draft.translations.en },
        status: "published",
      }),
    ).toThrow(AdminContentWriteValidationError);
    try {
      parseAdminContentWriteInput({
        ...draft,
        kind: "news",
        slug: "Not Valid",
        category: "other",
        translations: { ...draft.translations, fr: draft.translations.en },
        status: "published",
      });
    } catch (error) {
      expect((error as AdminContentWriteValidationError).fieldErrors).toMatchObject({
        kind: "invalid_format",
        slug: "invalid_format",
        category: "invalid_format",
        "translations.fr": "immutable",
        status: "immutable",
      });
    }
  });

  it("accepts only a known publication status", () => {
    expect(parseSetAdminContentPublicationInput({ status: "published" })).toEqual({ status: "published" });
    expect(() => parseSetAdminContentPublicationInput({ status: "public" })).toThrow(
      AdminContentPublicationValidationError,
    );
    expect(() => parseSetAdminContentPublicationInput({ status: "draft", extra: true })).toThrow(
      AdminContentPublicationValidationError,
    );
  });

  it("accepts optional hero ID and draft alt, but rejects invalid ID and excessive text", () => {
    const id = "550e8400-e29b-41d4-a716-446655440009";
    expect(parseAdminContentWriteInput({ ...draft, heroImageAssetId: id })).toMatchObject({ heroImageAssetId: id });
    expect(() => parseAdminContentWriteInput({ ...draft, heroImageAssetId: "https://example.com/image.jpg" })).toThrow(
      AdminContentWriteValidationError,
    );
    expect(() => parseAdminContentWriteInput({ ...draft, heroImageUrl: "https://example.com/image.jpg" })).toThrow(
      AdminContentWriteValidationError,
    );
    try {
      parseAdminContentWriteInput({
        ...draft,
        translations: {
          ...draft.translations,
          ja: { ...draft.translations.ja, heroImageAlt: "a".repeat(501), heroImageCaption: "b".repeat(1001) },
        },
      });
    } catch (error) {
      expect((error as AdminContentWriteValidationError).fieldErrors).toMatchObject({
        "translations.ja.heroImageAlt": "too_long",
        "translations.ja.heroImageCaption": "too_long",
      });
    }
  });
});
