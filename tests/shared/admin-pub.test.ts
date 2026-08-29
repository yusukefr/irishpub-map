import { describe, expect, it } from "vitest";
import {
  AdminPubPublicationValidationError,
  AdminPubSearchValidationError,
  parseAdminPubSearchParams,
  parseSetAdminPubPublicationInput,
} from "../../packages/shared/src/admin-pub";

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
