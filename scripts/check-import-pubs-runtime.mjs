import assert from "node:assert/strict";
import { parsePubs } from "./import-pubs.mjs";

const [pub] = parsePubs([
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Runtime smoke test pub",
    kana: "ランタイム確認",
    prefecture: "東京都",
    city: "千代田区",
    address: " 東京都千代田区  ",
    latitude: 35.6812,
    longitude: 139.7671,
    websiteUrl: null,
    googleMapsUrl: null,
    instagramUrl: null,
    tags: ["Irish"],
    status: "open",
    pubType: "irish",
  },
]);

assert.equal(pub.address, "東京都千代田区");
assert.deepEqual(pub.tags, ["irish"]);
