// 管理店舗のNULL可能詳細、参照検証、複数テーブルtransactionをDBモック越しに保証します。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAdminPub,
  insertAdminPub,
  removeAdminPub,
  replaceAdminPub,
  validateAdminPubReferences,
} from "../../apps/web/app/lib/admin-pub-repository";

const databaseMock = vi.hoisted(() => ({
  queries: [] as Array<{ text: string; values: unknown[] }>,
  responses: [] as Array<Array<Record<string, unknown>>>,
  transactionCount: 0,
  transactionOptions: [] as unknown[],
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const query = (strings: TemplateStringsArray, ...values: unknown[]) => {
      databaseMock.queries.push({ text: strings.join("?"), values });
      return Promise.resolve(databaseMock.responses.shift() ?? []);
    };
    query.transaction = async (callback: (transaction: typeof query) => Array<Promise<unknown>>, options?: unknown) => {
      databaseMock.transactionCount += 1;
      databaseMock.transactionOptions.push(options);
      return Promise.all(callback(query));
    };
    return query;
  },
}));

const originalDatabaseUrl = process.env.DATABASE_URL;
const pubId = "550e8400-e29b-41d4-a716-446655440001";
const tagId = "550e8400-e29b-41d4-a716-446655440010";
const draftInput = {
  prefectureCode: null,
  municipalityCode: null,
  latitude: null,
  longitude: null,
  websiteUrl: null,
  googleMapsUrl: null,
  instagramUrl: null,
  status: null,
  translations: {
    ja: { name: "下書き", nameReading: null, address: null },
    en: null,
  },
  tagIds: [] as string[],
};

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test-only";
  databaseMock.queries = [];
  databaseMock.responses = [];
  databaseMock.transactionCount = 0;
  databaseMock.transactionOptions = [];
});

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("admin pub repository", () => {
  it("returns a Japanese-name-only draft with nullable fields", async () => {
    databaseMock.responses = [
      [
        {
          id: pubId,
          is_published: false,
          prefecture_code: null,
          municipality_code: null,
          latitude: null,
          longitude: null,
          website_url: null,
          google_maps_url: null,
          instagram_url: null,
          status_key: null,
          updated_at: "2026-08-29T03:00:00.000Z",
          name_ja: "下書き",
          name_reading_ja: null,
          address_ja: null,
          name_en: null,
          name_reading_en: null,
          address_en: null,
          tag_ids: [],
        },
      ],
    ];

    await expect(getAdminPub(pubId)).resolves.toEqual({
      id: pubId,
      isPublished: false,
      ...draftInput,
      updatedAt: "2026-08-29T03:00:00.000Z",
    });
    expect(databaseMock.queries[0].text).toContain("LEFT JOIN pub_translations AS en");
  });

  it("validates master ownership and Japanese display records without creating masters", async () => {
    databaseMock.responses = [
      [
        {
          prefecture_valid: true,
          municipality_valid: false,
          status_valid: true,
          tags_valid: false,
          status_code: 1,
        },
      ],
    ];

    await expect(
      validateAdminPubReferences({
        ...draftInput,
        prefectureCode: 13,
        municipalityCode: "231002",
        status: "open",
        tagIds: [tagId],
      }),
    ).resolves.toEqual({
      fieldErrors: { municipalityCode: "invalid_format", tagIds: "invalid_format" },
      statusCode: 1,
    });
    expect(databaseMock.queries[0].text).toContain("municipality.prefecture_code");
    expect(databaseMock.queries[0].text).toContain("jsonb_array_elements_text");
    expect(databaseMock.queries[0].text).not.toContain("INSERT INTO tags");
  });

  it("creates the pub, translations, and existing tag relation in one transaction", async () => {
    databaseMock.responses = [[], [], [], []];
    await insertAdminPub(
      pubId,
      {
        ...draftInput,
        translations: {
          ja: draftInput.translations.ja,
          en: { name: "Draft", nameReading: null, address: "Tokyo" },
        },
        tagIds: [tagId],
      },
      null,
    );

    expect(databaseMock.transactionCount).toBe(1);
    expect(databaseMock.transactionOptions).toEqual([{ isolationLevel: "ReadCommitted" }]);
    expect(databaseMock.queries.map(({ text }) => text)).toEqual([
      expect.stringContaining("INSERT INTO pubs"),
      expect.stringContaining("'ja'"),
      expect.stringContaining("'en'"),
      expect.stringContaining("INSERT INTO pub_tags"),
    ]);
    expect(databaseMock.queries.every(({ text }) => !text.includes("INSERT INTO tags"))).toBe(true);
  });

  it("locks updates, clears English and tags, and reports the publication gate", async () => {
    databaseMock.responses = [[{ id: pubId }], [], [], [], []];
    await expect(replaceAdminPub(pubId, draftInput, null, false)).resolves.toBe("publication_blocked");

    expect(databaseMock.transactionCount).toBe(1);
    expect(databaseMock.queries[0].text).toContain("FOR UPDATE");
    expect(databaseMock.queries[1].text).toContain("NOT pub.is_published OR");
    expect(databaseMock.queries[3].text).toContain("DELETE FROM pub_translations");
    expect(databaseMock.queries[4].text).toContain("DELETE FROM pub_tags");
  });

  it("distinguishes a missing update and deletes through the pub foreign-key root", async () => {
    databaseMock.responses = [[], [], [], [], [], [{ id: pubId }]];
    await expect(replaceAdminPub(pubId, draftInput, null, true)).resolves.toBe("not_found");
    await expect(removeAdminPub(pubId)).resolves.toBe(true);
    expect(databaseMock.queries.at(-1)?.text).toContain("DELETE FROM pubs");
  });
});
