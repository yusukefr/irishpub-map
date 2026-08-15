import { describe, expect, it, vi } from "vitest";
import { parseDbPubs } from "../../apps/web/app/lib/pub-repository";

const baseRow = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Dubliners",
  kana: null,
  prefecture: "東京都",
  city: "新宿区",
  address: "東京都新宿区",
  latitude: 35.6911443,
  longitude: 139.7025086,
  website_url: "",
  google_maps_url: null,
  instagram_url: null,
  tags: ["guinness", "food"],
  status: "open",
};

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
        websiteUrl: null,
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
    expect(() => parseDbPubs([{ ...baseRow, status: "invalid" }])).toThrow("No valid pub data found in database.");
  });
});
