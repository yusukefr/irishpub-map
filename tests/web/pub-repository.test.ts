import { afterEach, describe, expect, it, vi } from "vitest";
import { getPubs, parseDbPubs } from "../../apps/web/app/lib/pub-repository";

const originalDatabaseUrl = process.env.DATABASE_URL;

function restoreDatabaseUrl() {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
}

const baseRow = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Dubliners",
  kana: null,
  prefecture_code: 13,
  city: "新宿区",
  municipality_code: "131041",
  address: "東京都新宿区",
  latitude: 35.6911443,
  longitude: 139.7025086,
  website_url: "",
  google_maps_url: null,
  instagram_url: null,
  tags: ["guinness", "food"],
  tag_display_names: { guinness: "ギネス", food: "食事あり" },
  status_code: 1,
  status_display_name: "営業中",
};

describe("getPubs", () => {
  afterEach(restoreDatabaseUrl);

  it("returns an empty list when the database is not configured", async () => {
    delete process.env.DATABASE_URL;

    await expect(getPubs()).resolves.toEqual([]);
  });
});

describe("parseDbPubs", () => {
  it("normalizes driver values before validating a database row", () => {
    const [pub] = parseDbPubs([
      {
        ...baseRow,
        latitude: "35.6911443",
        longitude: "139.7025086",
        tags: '["guinness", "food"]',
      },
    ]);

    expect(pub).toEqual(
      expect.objectContaining({
        latitude: 35.6911443,
        longitude: 139.7025086,
        tags: ["guinness", "food"],
        tagDisplayNames: { guinness: "ギネス", food: "食事あり" },
        statusDisplayName: "営業中",
        websiteUrl: null,
        municipalityCode: "131041",
      }),
    );
  });

  it("skips invalid rows while returning valid rows", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(parseDbPubs([baseRow, { ...baseRow, id: "invalid" }])).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalledWith("Skipped invalid pub rows from the database.", {
      skippedCount: 1,
      totalCount: 2,
    });

    errorSpy.mockRestore();
  });

  it("fails explicitly when every database row is invalid", () => {
    expect(() => parseDbPubs([{ ...baseRow, status_code: 99 }])).toThrow("No valid pub data found in database.");
  });
});
