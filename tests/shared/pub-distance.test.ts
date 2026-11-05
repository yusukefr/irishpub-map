import { describe, expect, it } from "vitest";
import type { Pub } from "@irishpub-map/shared";
import { calculateDistanceKm, sortPubsByDistance } from "@irishpub-map/shared";

const pub = (id: string, latitude: number, longitude: number, name = id): Pub => ({
  id,
  name,
  prefecture: "東京都",
  address: "Tokyo",
  latitude,
  longitude,
  tags: [],
  status: "open",
  pubType: "irish",
});

describe("Pub distance", () => {
  it("calculates zero, local, and antipodal great-circle distances", () => {
    expect(calculateDistanceKm({ latitude: 35, longitude: 139 }, { latitude: 35, longitude: 139 })).toBe(0);
    expect(calculateDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111.195, 2);
    expect(calculateDistanceKm({ latitude: -90, longitude: -180 }, { latitude: 90, longitude: 180 })).toBeCloseTo(
      20015.1,
      0,
    );
  });

  it("accepts geographic boundaries and rejects invalid coordinates", () => {
    expect(calculateDistanceKm({ latitude: 90, longitude: 180 }, { latitude: 90, longitude: 180 })).toBe(0);
    expect(() => calculateDistanceKm({ latitude: 90.01, longitude: 0 }, { latitude: 0, longitude: 0 })).toThrow(
      RangeError,
    );
    expect(() => calculateDistanceKm({ latitude: 0, longitude: Number.NaN }, { latitude: 0, longitude: 0 })).toThrow(
      RangeError,
    );
  });

  it("sorts pubs by distance and then stable Japanese name order", () => {
    expect(
      sortPubsByDistance([pub("far", 0, 1), pub("same-b", 0, 0, "ビアパブ"), pub("same-a", 0, 0, "アイリッシュパブ")], {
        latitude: 0,
        longitude: 0,
      }).map(({ pub: item }) => item.id),
    ).toEqual(["same-a", "same-b", "far"]);
  });
});
