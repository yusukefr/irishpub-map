import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAdminPubPage,
  getAdminPubs,
  getPublishedPubs,
  parseDbAdminPubs,
  parseDbPubs,
  PubPublicationValidationError,
  setAdminPubPublication,
} from "../../apps/web/app/lib/pub-repository";

const databaseMock = vi.hoisted(() => ({
  queries: [] as Array<{ text: string; values: unknown[] }>,
  rows: [] as Array<Record<string, unknown>>,
  responses: [] as Array<Array<Record<string, unknown>>>,
}));

vi.mock("@neondatabase/serverless", () => ({
  neon:
    () =>
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      const includeUnpublished = values.find((value) => typeof value === "boolean") === true;
      databaseMock.queries.push({ text, values });
      if (databaseMock.responses.length > 0) return Promise.resolve(databaseMock.responses.shift()!);
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
  databaseMock.responses = [];
});

describe("admin pub list search", () => {
  it("passes all filters as parameters and returns a bounded page with both publication states", async () => {
    process.env.DATABASE_URL = "postgres://test-only";
    databaseMock.responses = [
      [
        {
          ...baseRow,
          status_key: "open",
          tag_items: [{ id: "550e8400-e29b-41d4-a716-446655440010", key: "guinness", name: "ギネス" }],
          updated_at: "2026-08-29T01:00:00.000Z",
          total_count: 2,
        },
        {
          ...baseRow,
          id: "550e8400-e29b-41d4-a716-446655440002",
          is_published: false,
          status_key: "open",
          tag_items: [],
          updated_at: "2026-08-28T01:00:00.000Z",
          total_count: 2,
        },
      ],
    ];

    const page = await getAdminPubPage({
      name: "Dublin",
      prefectureCode: 13,
      municipalityCode: "131041",
      statusKey: "open",
      tagId: "550e8400-e29b-41d4-a716-446655440010",
      isPublished: false,
      page: 2,
    });

    expect(page).toEqual(expect.objectContaining({ total: 2, page: 2, pageSize: 50 }));
    expect(page.pubs.map((pub) => pub.isPublished)).toEqual([true, false]);
    expect(page.pubs[0]).toEqual(
      expect.objectContaining({
        prefectureCode: 13,
        statusDisplayName: "営業中",
        updatedAt: "2026-08-29T01:00:00.000Z",
      }),
    );
    expect(databaseMock.queries[0].text).toContain("ILIKE '%' || ? || '%'");
    expect(databaseMock.queries[0].text).toContain("LIMIT ? OFFSET ?");
    expect(databaseMock.queries[0].values).toEqual(
      expect.arrayContaining(["Dublin", 13, "131041", "open", "550e8400-e29b-41d4-a716-446655440010", false, 50]),
    );
  });

  it("returns an empty bounded page without a configured database", async () => {
    delete process.env.DATABASE_URL;
    await expect(getAdminPubPage({ page: 4 })).resolves.toEqual({ pubs: [], total: 0, page: 4, pageSize: 50 });
  });

  it("keeps a Japanese-name-only draft in the admin list", async () => {
    process.env.DATABASE_URL = "postgres://test-only";
    databaseMock.responses = [
      [
        {
          ...baseRow,
          prefecture_code: null,
          prefecture: null,
          city: null,
          municipality_code: null,
          address: null,
          latitude: null,
          longitude: null,
          status_code: null,
          status_key: null,
          status_display_name: null,
          tags: [],
          tag_display_names: {},
          tag_items: [],
          is_published: false,
          updated_at: "2026-08-29T01:00:00.000Z",
          total_count: 1,
        },
      ],
    ];

    const page = await getAdminPubPage({ page: 1 });
    expect(page.pubs[0]).toEqual(
      expect.objectContaining({
        name: "Dubliners",
        prefectureCode: null,
        municipalityCode: null,
        address: null,
        latitude: null,
        status: null,
        statusDisplayName: null,
        isPublished: false,
      }),
    );
    expect(databaseMock.queries[0].text).toContain("LEFT JOIN pub_statuses");
  });

  it("keeps the filtered total when the requested page is out of range", async () => {
    process.env.DATABASE_URL = "postgres://test-only";
    databaseMock.responses = [[], [{ total_count: 30 }]];

    await expect(getAdminPubPage({ prefectureCode: 13, page: 2 })).resolves.toEqual({
      pubs: [],
      total: 30,
      page: 2,
      pageSize: 50,
    });
    expect(databaseMock.queries).toHaveLength(2);
    expect(databaseMock.queries[1].text).toContain("SELECT COUNT(*)::int AS total_count");
    expect(databaseMock.queries[1].values).toContain(13);
  });
});

describe("admin pub publication updates", () => {
  const completeSnapshot = {
    is_published: false,
    has_name: true,
    has_address: true,
    has_prefecture: true,
    has_municipality: true,
    has_latitude: true,
    has_longitude: true,
    has_status: true,
    has_tags: true,
  };

  it("publishes a complete pub and keeps the validation gate in the UPDATE", async () => {
    process.env.DATABASE_URL = "postgres://test-only";
    databaseMock.responses = [[completeSnapshot], [{ id: baseRow.id }]];

    await expect(setAdminPubPublication(baseRow.id, true)).resolves.toEqual({
      id: baseRow.id,
      isPublished: true,
      unchanged: false,
    });
    expect(databaseMock.queries[1].text).toContain("municipality.prefecture_code=pub.prefecture_code");
    expect(databaseMock.queries[1].text).toContain("SET is_published=?");
  });

  it("rejects publication with all missing fields without issuing an update", async () => {
    process.env.DATABASE_URL = "postgres://test-only";
    databaseMock.responses = [[{ ...completeSnapshot, has_address: false, has_latitude: false }]];

    await expect(setAdminPubPublication(baseRow.id, true)).rejects.toMatchObject<PubPublicationValidationError>({
      missingFields: ["address", "latitude"],
    });
    expect(databaseMock.queries).toHaveLength(1);
  });

  it("rejects publication when an assigned tag has no Japanese display name", async () => {
    process.env.DATABASE_URL = "postgres://test-only";
    databaseMock.responses = [[{ ...completeSnapshot, has_tags: false }]];

    await expect(setAdminPubPublication(baseRow.id, true)).rejects.toMatchObject<PubPublicationValidationError>({
      missingFields: ["tags"],
    });
    expect(databaseMock.queries).toHaveLength(1);
  });

  it("unpublishes without publish validation and treats the current state idempotently", async () => {
    process.env.DATABASE_URL = "postgres://test-only";
    databaseMock.responses = [[{ ...completeSnapshot, is_published: true, has_address: false }], [{ id: baseRow.id }]];
    await expect(setAdminPubPublication(baseRow.id, false)).resolves.toEqual({
      id: baseRow.id,
      isPublished: false,
      unchanged: false,
    });

    databaseMock.responses = [[completeSnapshot]];
    await expect(setAdminPubPublication(baseRow.id, false)).resolves.toEqual({
      id: baseRow.id,
      isPublished: false,
      unchanged: true,
    });
  });

  it("returns null for a missing pub", async () => {
    process.env.DATABASE_URL = "postgres://test-only";
    databaseMock.responses = [[]];
    await expect(setAdminPubPublication(baseRow.id, true)).resolves.toBeNull();
  });
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
