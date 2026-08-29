import { describe, expect, it } from "vitest";
import {
  AdminPubPublicationValidationError,
  AdminPubSearchValidationError,
  AdminPubWriteValidationError,
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
