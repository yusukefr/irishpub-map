import { describe, expect, it } from "vitest";
import {
  getContentPublicationMissingFields,
  hasOnlySafeMarkdownUrls,
  isAllowedMarkdownUrl,
} from "../../apps/web/app/lib/content/validation";

describe("editorial content validation", () => {
  it("reports language-independent and locale-specific publication requirements", () => {
    expect(
      getContentPublicationMissingFields({
        kind: null,
        slug: null,
        category: null,
        heroImageAssetId: null,
        translations: {
          ja: { title: "", summary: "要約", bodyMarkdown: "   ", heroImageAlt: "", heroImageCaption: "" },
          en: { title: "Title", summary: "", bodyMarkdown: "Body", heroImageAlt: "", heroImageCaption: "" },
        },
      }),
    ).toEqual([
      "kind",
      "slug",
      "category",
      "translations.ja.title",
      "translations.ja.bodyMarkdown",
      "translations.en.summary",
    ]);
  });

  it("allows HTTP(S), root-relative, and fragment Markdown URLs parsed from all URL node forms", () => {
    expect(
      hasOnlySafeMarkdownUrls(
        "[site](https://example.com) ![image](/image.png) [section](#history)\n[ref]: http://example.com\n[reference][ref]\n<https://example.com>",
      ),
    ).toBe(true);
    expect(isAllowedMarkdownUrl("//example.com")).toBe(false);
  });

  it("requires both locale alt texts only when a hero is selected", () => {
    const input = {
      kind: "story" as const,
      slug: "story",
      category: "culture" as const,
      heroImageAssetId: null as string | null,
      translations: {
        ja: { title: "記事", summary: "概要", bodyMarkdown: "本文", heroImageAlt: "", heroImageCaption: "" },
        en: { title: "Story", summary: "Summary", bodyMarkdown: "Body", heroImageAlt: "", heroImageCaption: "" },
      },
    };
    expect(getContentPublicationMissingFields(input)).toEqual([]);
    input.heroImageAssetId = "550e8400-e29b-41d4-a716-446655440009";
    expect(getContentPublicationMissingFields(input)).toEqual([
      "translations.ja.heroImageAlt",
      "translations.en.heroImageAlt",
    ]);
    input.translations.ja.heroImageAlt = "説明";
    input.translations.en.heroImageAlt = "Description";
    expect(getContentPublicationMissingFields(input)).toEqual([]);
  });

  it("rejects explicit and GFM email autolinks resolved to mailto URLs", () => {
    expect(hasOnlySafeMarkdownUrls("<foo@localhost>")).toBe(false);
    expect(hasOnlySafeMarkdownUrls("foo@x.c")).toBe(false);
  });

  it("rejects dangerous schemes after Markdown entity decoding", () => {
    expect(hasOnlySafeMarkdownUrls("[x](javascript:alert(1))")).toBe(false);
    expect(hasOnlySafeMarkdownUrls("[x](data:text/html,test)")).toBe(false);
    expect(hasOnlySafeMarkdownUrls("[x](&#x6a;avascript:alert(1))")).toBe(false);
    expect(hasOnlySafeMarkdownUrls("[mail](mailto:feedback)")).toBe(false);
  });

  it("returns validation failure instead of throwing for an invalid numeric character reference", () => {
    expect(() => hasOnlySafeMarkdownUrls("[x](&#9999999999;)")).not.toThrow();
    expect(hasOnlySafeMarkdownUrls("[x](&#9999999999;)")).toBe(false);
  });
});
