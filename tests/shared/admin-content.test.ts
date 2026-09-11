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
  translations: {
    ja: { title: "", summary: "", bodyMarkdown: "" },
    en: { title: "", summary: "", bodyMarkdown: "" },
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
          ja: { title: "  パブの作法  ", summary: "", bodyMarkdown: "    const value = 1;\n" },
          en: { title: "", summary: "", bodyMarkdown: "" },
        },
      }),
    ).toEqual({
      kind: "guide",
      slug: "pub-etiquette",
      category: "pub-culture",
      translations: {
        ja: { title: "パブの作法", summary: "", bodyMarkdown: "    const value = 1;\n" },
        en: { title: "", summary: "", bodyMarkdown: "" },
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
});
