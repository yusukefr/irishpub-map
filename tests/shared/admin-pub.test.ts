import { describe, expect, it } from "vitest";
import {
  AdminPubPublicationValidationError,
  AdminPubSearchValidationError,
  AdminPubWriteValidationError,
  parseAdminPubAddress,
  parseAdminPubUrl,
  parseAdminPubWriteInput,
  parseAdminPubSearchParams,
  parseSetAdminPubPublicationInput,
} from "../../packages/shared/src/admin-pub";

const draftInput = {
  prefectureCode: null,
  municipalityCode: null,
  latitude: null,
  longitude: null,
  websiteUrl: null,
  googleMapsUrl: null,
  instagramUrl: null,
  status: null,
  pubType: null,
  translations: {
    ja: { name: "  アイリッシュパブ  ", nameReading: null, address: null },
    en: null,
  },
  tagIds: [],
};

describe("admin pub search validation", () => {
  it("normalizes all supported filters", () => {
    const params = new URLSearchParams({
      name: "  shamrock  ",
      prefecture: "23",
      municipality: "231002",
      status: "open",
      tag: "550e8400-e29b-41d4-a716-446655440001",
      published: "false",
      page: "3",
    });

    expect(parseAdminPubSearchParams(params)).toEqual({
      name: "shamrock",
      prefectureCode: 23,
      municipalityCode: "231002",
      statusKey: "open",
      tagId: "550e8400-e29b-41d4-a716-446655440001",
      isPublished: false,
      page: 3,
    });
  });

  it("accepts uppercase UUID query IDs without rewriting their input spelling", () => {
    expect(parseAdminPubSearchParams(new URLSearchParams({ tag: "550E8400-E29B-41D4-A716-446655440001" }))).toEqual({
      tagId: "550E8400-E29B-41D4-A716-446655440001",
      page: 1,
    });
  });

  it("uses defaults for empty values and accepts the published state", () => {
    expect(parseAdminPubSearchParams(new URLSearchParams("name=&published=true"))).toEqual({
      isPublished: true,
      page: 1,
    });
  });

  it("rejects a name over the maximum length", () => {
    expect(() => parseAdminPubSearchParams(new URLSearchParams({ name: "a".repeat(101) }))).toThrow(
      AdminPubSearchValidationError,
    );
  });

  it.each([
    "unknown=value",
    "prefecture=48",
    "municipality=231002",
    "prefecture=24&municipality=231002",
    "status=deleted",
    "tag=not-a-uuid",
    "published=yes",
    "page=0",
    "page=1&page=2",
  ])("rejects invalid query: %s", (query) => {
    expect(() => parseAdminPubSearchParams(new URLSearchParams(query))).toThrow(AdminPubSearchValidationError);
  });
});

describe("admin pub publication validation", () => {
  it.each([true, false])("accepts isPublished=%s", (isPublished) => {
    expect(parseSetAdminPubPublicationInput({ isPublished })).toEqual({ isPublished });
  });

  it.each([null, {}, { isPublished: "true" }, { isPublished: true, extra: true }])("rejects %j", (value) => {
    expect(() => parseSetAdminPubPublicationInput(value)).toThrow(AdminPubPublicationValidationError);
  });
});

describe("admin pub write validation", () => {
  it("accepts a Japanese-name-only draft and normalizes text", () => {
    expect(parseAdminPubWriteInput(draftInput)).toEqual({
      ...draftInput,
      translations: {
        ja: { name: "アイリッシュパブ", nameReading: null, address: null },
        en: null,
      },
    });
  });

  it("accepts complete optional fields and an English translation", () => {
    expect(
      parseAdminPubWriteInput({
        ...draftInput,
        prefectureCode: 13,
        municipalityCode: "131016",
        latitude: 35.6812,
        longitude: 139.7671,
        websiteUrl: " https://example.com/pub ",
        status: "open",
        translations: {
          ja: { name: "店舗名", nameReading: " てんぽめい ", address: " 東京都 " },
          en: { name: " Pub Name ", nameReading: null, address: " Tokyo " },
        },
        tagIds: ["550e8400-e29b-41d4-a716-446655440001"],
      }),
    ).toMatchObject({
      websiteUrl: "https://example.com/pub",
      translations: {
        ja: { name: "店舗名", nameReading: "てんぽめい", address: "東京都" },
        en: { name: "Pub Name", nameReading: null, address: "Tokyo" },
      },
    });
  });

  it("rejects duplicate tag UUIDs even when letter case differs", () => {
    expect(() =>
      parseAdminPubWriteInput({
        ...draftInput,
        tagIds: ["550e8400-e29b-41d4-a716-446655440001", "550E8400-E29B-41D4-A716-446655440001"],
      }),
    ).toThrow(expect.objectContaining({ fieldErrors: { tagIds: "invalid_format" } }));
  });

  it.each(["websiteUrl", "googleMapsUrl", "instagramUrl"] as const)(
    "requires the %s key in a full write snapshot",
    (field) => {
      const input: Record<string, unknown> = { ...draftInput };
      delete input[field];

      expect(() => parseAdminPubWriteInput(input)).toThrow(
        expect.objectContaining({ fieldErrors: { [field]: "required" } }),
      );
    },
  );

  it("normalizes blank URLs, preserves URL text, and validates service hosts and paths", () => {
    expect(parseAdminPubUrl("  ", "websiteUrl")).toEqual({ value: null });
    expect(parseAdminPubUrl(" https://EXAMPLE.com/a?b=1 ", "websiteUrl")).toEqual({
      value: "https://EXAMPLE.com/a?b=1",
    });
    for (const url of [
      "https://www.google.com/maps",
      "https://www.google.com/maps/place/Pub",
      "https://google.com/maps/search/?api=1&query=pub",
      "https://maps.google.com/?cid=123",
      "https://maps.app.goo.gl/AbCd123",
    ]) {
      expect(parseAdminPubUrl(url, "googleMapsUrl")).toEqual({ value: url });
    }
    expect(parseAdminPubUrl("https://www.google.com.evil.example/maps", "googleMapsUrl").error).toBe("invalid_format");
    for (const url of [
      "https://instagram.com/pub_name/",
      "https://www.instagram.com/p/AbCd_123/",
      "https://instagram.com/reel/AbCd-123",
    ]) {
      expect(parseAdminPubUrl(url, "instagramUrl")).toEqual({ value: url });
    }
    expect(parseAdminPubUrl("https://instagram.example/pub", "instagramUrl").error).toBe("invalid_format");
  });

  it.each([
    "javascript:alert(1)",
    "https://u:p@a/",
    "https://example.com:99999/",
    "https://example.com/\npath",
    "https://example.com/" + "a".repeat(2_040),
  ])("rejects unsafe or oversized URL %s", (url) => {
    expect(parseAdminPubUrl(url, "websiteUrl").error).toMatch(/invalid_format|too_long/);
  });

  it("reports URL type, parse, scheme, and Maps path failures with stable codes", () => {
    expect(parseAdminPubUrl(42, "websiteUrl").error).toBe("invalid_type");
    expect(parseAdminPubUrl("https://[", "websiteUrl").error).toBe("invalid_format");
    expect(parseAdminPubUrl("ftp://example.com", "websiteUrl").error).toBe("invalid_format");
    expect(parseAdminPubUrl("https://google.com/search?q=pub", "googleMapsUrl").error).toBe("invalid_format");
    expect(parseAdminPubUrl("https://maps.app.goo.gl/", "googleMapsUrl").error).toBe("invalid_format");
    expect(parseAdminPubUrl("https://www.instagram.com/invalid..name", "instagramUrl").error).toBe("invalid_format");
    expect(parseAdminPubUrl("https://instagram.com/p/a/", "instagramUrl").error).toBe("invalid_format");
    expect(parseAdminPubUrl("https://instagram.com/stories/pub/", "instagramUrl").error).toBe("invalid_format");
    expect(parseAdminPubUrl("https://:p@a/", "websiteUrl").error).toBe("invalid_format");
  });

  it("returns field-specific errors for malformed translation containers and text types", () => {
    try {
      parseAdminPubWriteInput({
        ...draftInput,
        translations: { ja: { name: 42, nameReading: null, address: null }, en: "invalid" },
      });
      expect.fail("validation should fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AdminPubWriteValidationError);
      expect((error as AdminPubWriteValidationError).fieldErrors).toMatchObject({
        "translations.ja.name": "invalid_type",
        "translations.en": "invalid_type",
      });
    }
  });

  it("trims addresses, allows optional Japanese Draft address, and enforces controls and 300 characters", () => {
    expect(parseAdminPubAddress("  東京都  ")).toEqual({ value: "東京都" });
    expect(parseAdminPubAddress(null)).toEqual({ value: null });
    expect(parseAdminPubAddress("a".repeat(300))).toEqual({ value: "a".repeat(300) });
    expect(parseAdminPubAddress("a".repeat(301)).error).toBe("too_long");
    expect(parseAdminPubAddress("Tokyo\nJapan").error).toBe("invalid_format");
    expect(parseAdminPubAddress(null, true).error).toBe("required");
    expect(parseAdminPubAddress(undefined).value).toBeNull();
    expect(parseAdminPubAddress("  ", true).error).toBe("required");
    expect(parseAdminPubAddress(42).error).toBe("invalid_type");
  });

  it.each([
    [{ ...draftInput, isPublished: true }, "isPublished", "immutable"],
    [{ ...draftInput, latitude: 91 }, "latitude", "invalid_format"],
    [{ ...draftInput, websiteUrl: "javascript:alert(1)" }, "websiteUrl", "invalid_format"],
    [
      {
        ...draftInput,
        translations: { ...draftInput.translations, ja: { ...draftInput.translations.ja, name: " " } },
      },
      "translations.ja.name",
      "required",
    ],
    [
      {
        ...draftInput,
        translations: {
          ...draftInput.translations,
          en: { name: "Pub", nameReading: null, address: null },
        },
      },
      "translations.en.address",
      "required",
    ],
    [
      {
        ...draftInput,
        tagIds: ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440001"],
      },
      "tagIds",
      "invalid_format",
    ],
  ])("rejects invalid write input", (value, field, code) => {
    try {
      parseAdminPubWriteInput(value);
      expect.fail("validation should fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AdminPubWriteValidationError);
      expect((error as AdminPubWriteValidationError).fieldErrors).toMatchObject({
        [field as string]: code,
      });
    }
  });
});
