// DB行を管理用DTOへ変換し、市区町村を指定都道府県だけに絞ることを保証します。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMunicipalitiesByPrefecture,
  getPrefectures,
  getPubStatuses,
  getTags,
} from "../../apps/web/app/lib/master-repository";

const databaseMock = vi.hoisted(() => ({
  queries: [] as Array<{ text: string; values: unknown[] }>,
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@neondatabase/serverless", () => ({
  neon:
    () =>
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      databaseMock.queries.push({ text, values });
      const prefectureCode = values.find((value) => typeof value === "number");
      return Promise.resolve(
        text.includes("FROM municipality_codes")
          ? databaseMock.rows.filter((row) => row.prefecture_code === prefectureCode)
          : databaseMock.rows,
      );
    },
}));

const originalDatabaseUrl = process.env.DATABASE_URL;

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test-only";
  databaseMock.queries = [];
  databaseMock.rows = [];
});

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("master repository", () => {
  it("returns prefectures with Japanese display names in code order", async () => {
    databaseMock.rows = [
      { code: 13, name: "東京都" },
      { code: "23", name: "愛知県" },
    ];

    await expect(getPrefectures()).resolves.toEqual([
      { code: 13, name: "東京都" },
      { code: 23, name: "愛知県" },
    ]);
    expect(databaseMock.queries[0].text).toContain("ORDER BY prefecture.code");
    expect(databaseMock.queries[0].values).toContain("ja");
  });

  it("returns only municipalities related to the selected prefecture", async () => {
    databaseMock.rows = [
      { code: "231002", prefecture_code: 23, name: "名古屋市" },
      { code: "131016", prefecture_code: 13, name: "千代田区" },
    ];

    await expect(getMunicipalitiesByPrefecture(23)).resolves.toEqual([
      { code: "231002", prefectureCode: 23, name: "名古屋市" },
    ]);
    expect(databaseMock.queries[0].text).toContain("WHERE municipality.prefecture_code =");
    expect(databaseMock.queries[0].values).toContain(23);
  });

  it("returns tag and status DTOs without exposing database rows", async () => {
    databaseMock.rows = [{ id: "550e8400-e29b-41d4-a716-446655440001", key: "guinness", name: "ギネス" }];
    await expect(getTags()).resolves.toEqual([
      { id: "550e8400-e29b-41d4-a716-446655440001", key: "guinness", name: "ギネス" },
    ]);

    databaseMock.rows = [{ code: "1", key: "open", name: "営業中" }];
    await expect(getPubStatuses()).resolves.toEqual([{ code: 1, key: "open", name: "営業中" }]);
  });

  it("returns empty lists without opening a connection when the database is not configured", async () => {
    delete process.env.DATABASE_URL;

    await expect(
      Promise.all([getPrefectures(), getMunicipalitiesByPrefecture(23), getTags(), getPubStatuses()]),
    ).resolves.toEqual([[], [], [], []]);
    expect(databaseMock.queries).toEqual([]);
  });

  it("rejects malformed database master rows", async () => {
    databaseMock.rows = [{ code: "invalid", name: "東京都" }];
    await expect(getPrefectures()).rejects.toThrow("Invalid master code returned from database.");
  });
});
