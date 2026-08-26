import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminPubs, getPublishedPubs, parseDbAdminPubs, parseDbPubs } from "../../apps/web/app/lib/pub-repository";

const databaseMock = vi.hoisted(() => ({
  queries: [] as Array<{ text: string; values: unknown[] }>,
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@neondatabase/serverless", () => ({
  neon:
    () =>
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      const includeUnpublished = values.find((value) => typeof value === "boolean") === true;
      databaseMock.queries.push({ text, values });
      return Promise.resolve(databaseMock.rows.filter((row) => includeUnpublished || row.is_published === true));
    },
}));

const originalDatabaseUrl = process.env.DATABASE_URL;

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
  is_published: true,
};

beforeEach(() => {
  databaseMock.queries = [];
  databaseMock.rows = [];
});

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("publication-aware pub queries", () => {
  it("returns an empty public list when the database is not configured", async () => {
    delete process.env.DATABASE_URL;

    await expect(getPublishedPubs()).resolves.toEqual([]);
    expect(databaseMock.queries).toEqual([]);
  });

  it("returns only published pubs without exposing publication metadata", async () => {
    process.env.DATABASE_URL = "postgres://test-only";
    databaseMock.rows = [baseRow, { ...baseRow, id: "550e8400-e29b-41d4-a716-446655440002", is_published: false }];

    const pubs = await getPublishedPubs("en");

    expect(pubs.map((pub) => pub.id)).toEqual([baseRow.id]);
    expect(pubs[0]).not.toHaveProperty("isPublished");
    expect(databaseMock.queries[0].text).toContain("WHERE p.is_published = TRUE OR");
    expect(databaseMock.queries[0].values).toContain(false);
  });

  it("returns published and unpublished pubs with their state for administrators", async () => {
    process.env.DATABASE_URL = "postgres://test-only";
    databaseMock.rows = [baseRow, { ...baseRow, id: "550e8400-e29b-41d4-a716-446655440002", is_published: false }];

    const pubs = await getAdminPubs();

    expect(pubs.map(({ id, isPublished }) => ({ id, isPublished }))).toEqual([
      { id: "550e8400-e29b-41d4-a716-446655440001", isPublished: true },
      { id: "550e8400-e29b-41d4-a716-446655440002", isPublished: false },
    ]);
    expect(databaseMock.queries[0].values).toContain(true);
  });
});

describe("parseDbAdminPubs", () => {
  it("rejects rows without a boolean publication state", () => {
    expect(() => parseDbAdminPubs([{ ...baseRow, is_published: null }])).toThrow(
      "No valid admin pub data found in database.",
    );
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
