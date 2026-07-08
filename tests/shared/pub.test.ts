import { describe, expect, it } from "vitest";
import { asPubs, type Pub } from "../../packages/shared/src/pub";

const basePub: Pub = {
  id: "tokyo-sample",
  name: "Tokyo Sample Pub",
  prefecture: "東京都",
  city: "千代田区",
  address: "東京都千代田区1-1-1",
  latitude: 35.681,
  longitude: 139.767,
  websiteUrl: "https://example.com",
  googleMapsUrl: "https://maps.example.com",
  instagramUrl: null,
  tags: ["guinness", "food"],
  status: "open"
};

describe("asPubs", () => {
  it("returns typed pub data when every item is valid", () => {
    const statuses: Pub["status"][] = ["open", "temporarily_closed", "closed", "unknown"];
    const pubs = statuses.map((status, index) => ({
      ...basePub,
      id: `pub-${status}`,
      city: index % 2 === 0 ? basePub.city : undefined,
      websiteUrl: index % 2 === 0 ? basePub.websiteUrl : null,
      googleMapsUrl: index % 2 === 0 ? basePub.googleMapsUrl : undefined,
      status
    }));

    expect(asPubs(pubs)).toEqual(pubs);
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
    expect(() => asPubs([{ ...basePub, websiteUrl: 123 }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, googleMapsUrl: 123 }])).toThrow("Invalid pub data found.");
    expect(() => asPubs([{ ...basePub, instagramUrl: 123 }])).toThrow("Invalid pub data found.");
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
