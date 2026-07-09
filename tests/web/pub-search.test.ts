import { describe, expect, it } from "vitest";
import {
  filterPubs,
  filterPubsByQuery,
  getAvailablePrefectures,
  getAvailableStatuses,
  getAvailableTags
} from "../../apps/web/app/lib/pub-search";
import type { Pub } from "../../packages/shared/src/pub";

const pubs: Pub[] = [
  {
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
  },
  {
    id: "osaka-sample",
    name: "Osaka Sample Pub",
    prefecture: "大阪府",
    city: "大阪市",
    address: "大阪府大阪市1-1-1",
    latitude: 34.693,
    longitude: 135.502,
    websiteUrl: null,
    googleMapsUrl: null,
    instagramUrl: null,
    tags: ["live-music"],
    status: "unknown"
  },
  {
    id: "kyoto-sample",
    name: "Kyoto Sample Pub",
    prefecture: "京都府",
    address: "京都府京都市1-1-1",
    latitude: 35.011,
    longitude: 135.768,
    websiteUrl: null,
    googleMapsUrl: null,
    instagramUrl: null,
    tags: ["food"],
    status: "closed"
  }
];

describe("filterPubsByQuery", () => {
  it("filters pubs by pub name", () => {
    expect(filterPubsByQuery(pubs, "osaka").map((pub) => pub.id)).toEqual(["osaka-sample"]);
  });

  it("filters pubs by prefecture", () => {
    expect(filterPubsByQuery(pubs, "東京都").map((pub) => pub.id)).toEqual(["tokyo-sample"]);
  });

  it("filters pubs by city area", () => {
    expect(filterPubsByQuery(pubs, "大阪市").map((pub) => pub.id)).toEqual(["osaka-sample"]);
  });

  it("filters pubs by selected prefecture", () => {
    expect(filterPubs(pubs, { prefecture: "京都府" }).map((pub) => pub.id)).toEqual(["kyoto-sample"]);
  });

  it("filters pubs by tag", () => {
    expect(filterPubs(pubs, { tag: "food" }).map((pub) => pub.id)).toEqual(["tokyo-sample", "kyoto-sample"]);
  });

  it("filters pubs by status", () => {
    expect(filterPubs(pubs, { status: "closed" }).map((pub) => pub.id)).toEqual(["kyoto-sample"]);
  });

  it("combines search, prefecture, tag, and status filters", () => {
    expect(
      filterPubs(pubs, { query: "京都府", prefecture: "京都府", tag: "food", status: "closed" }).map((pub) => pub.id)
    ).toEqual(["kyoto-sample"]);
  });

  it("returns all pubs when the query is blank", () => {
    expect(filterPubsByQuery(pubs, "  ")).toEqual(pubs);
  });

  it("returns sorted available prefectures, tags, and statuses", () => {
    expect(getAvailablePrefectures(pubs)).toEqual(["京都府", "大阪府", "東京都"]);
    expect(getAvailableTags(pubs)).toEqual(["food", "guinness", "live-music"]);
    expect(getAvailableStatuses(pubs)).toEqual(["closed", "open", "unknown"]);
  });
});
