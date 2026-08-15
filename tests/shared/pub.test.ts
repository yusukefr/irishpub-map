// 店舗データ境界で、不正値と重複IDが拒否されることを保証するテストです。
import { describe, expect, it } from "vitest";
import { asPubs, type Pub } from "../../packages/shared/src/pub";

const basePub: Pub = {
  id: "550e8400-e29b-41d4-a716-446655440101",
  name: "Tokyo Sample Pub",
  kana: "とーきょー さんぷる ぱぶ",
  prefecture: "東京都",
  city: "千代田区",
  address: "東京都千代田区1-1-1",
  latitude: 35.681,
  longitude: 139.767,
  websiteUrl: "https://example.com",
  googleMapsUrl: "https://maps.example.com",
  instagramUrl: null,
  tags: ["guinness", "food"],
  status: "open",
};

describe("asPubs", () => {
  it("returns typed pub data when every item is valid", () => {
    const statuses: Pub["status"][] = ["open", "temporarily_closed", "closed", "unknown"];
    const pubs = statuses.map((status, index) => ({
      ...basePub,
      id: `550e8400-e29b-41d4-a716-44665544010${index + 2}`,
      city: index % 2 === 0 ? basePub.city : undefined,
      websiteUrl: index % 2 === 0 ? basePub.websiteUrl : null,
      googleMapsUrl: index % 2 === 0 ? basePub.googleMapsUrl : undefined,
      status,
    }));

    expect(asPubs(pubs)).toEqual(pubs.map((pub) => ({ ...pub, googleMapsUrl: pub.googleMapsUrl ?? null })));
  });

  it("normalizes empty optional values", () => {
    expect(
      asPubs([
        {
          ...basePub,
          kana: null,
          city: "  ",
          websiteUrl: " ",
          googleMapsUrl: " https://maps.example.com ",
          instagramUrl: undefined,
        },
      ]),
    ).toEqual([
      {
        ...basePub,
        kana: undefined,
        city: undefined,
        websiteUrl: null,
        googleMapsUrl: "https://maps.example.com",
        instagramUrl: null,
      },
    ]);
  });

  it("rejects non-array input", () => {
    expect(() => asPubs({ ...basePub })).toThrow("Pub data must be an array.");
  });

  it("rejects null and primitive items", () => {
    expect(() => asPubs([null])).toThrow("Invalid pub data found.");
    expect(() => asPubs(["pub"])).toThrow("Invalid pub data found.");
  });

  it("rejects items with invalid required fields", () => {
    expect(() => asPubs([{ ...basePub, id: 1 }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, name: null }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, prefecture: null }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, address: null }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, latitude: "35" }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, longitude: "139" }])).toThrow("Invalid pub data found.");
  });

  it("rejects duplicate ids", () => {
    expect(() => asPubs([basePub, { ...basePub, name: "Duplicate Pub" }])).toThrow("Invalid pub data found.");
  });

  it("rejects invalid optional fields", () => {
    expect(() => asPubs([{ ...basePub, city: 123 }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, kana: 123 }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, websiteUrl: 123 }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, googleMapsUrl: 123 }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, instagramUrl: 123 }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, websiteUrl: "ftp://example.com" }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, id: "legacy-id" }])).toThrow("Invalid pub data found.");
  });

  it("rejects non-finite and out-of-range coordinates", () => {
    expect(() => asPubs([{ ...basePub, latitude: Number.NaN }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, longitude: Number.POSITIVE_INFINITY }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, latitude: 91 }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, latitude: -91 }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, longitude: 181 }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, longitude: -181 }])).toThrow("Invalid pub data found.");
  });

  it("rejects invalid tags and status", () => {
    expect(() => asPubs([{ ...basePub, tags: "guinness" }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, tags: ["guinness", 1] }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, status: "opening-soon" }])).toThrow("Invalid pub data found.");
  });
});
