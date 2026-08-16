import { describe, expect, it, vi } from "vitest";
import { getSourcePath, importPubs, parsePubs } from "../scripts/import-pubs.mjs";

const pub = {
  id: "550e8400-e29b-41d4-a716-446655440201",
  name: "Test Pub",
  kana: "てすと ぱぶ",
  prefecture: "東京都",
  address: "東京都千代田区1-1-1",
  latitude: 35.68,
  longitude: 139.76,
  tags: ["guinness"],
  status: "open",
};

describe("parsePubs", () => {
  it("accepts valid pub data", () => {
    expect(parsePubs([pub])).toEqual([pub]);
  });

  it("rejects duplicate IDs and invalid records", () => {
    expect(() => parsePubs([pub, { ...pub, name: "Duplicate" }])).toThrow("Invalid pub data found.");
    expect(() => parsePubs([{ ...pub, status: "invalid" }])).toThrow("Invalid pub data found.");
    expect(() => parsePubs([{ ...pub, kana: 123 }])).toThrow("Invalid pub data found.");
    expect(() => parsePubs([{ ...pub, id: "legacy-id" }])).toThrow("Invalid pub data found.");
  });
});

describe("importPubs", () => {
  it("inserts new records and skips existing IDs", async () => {
    let insertIndex = 0;
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings[0].trimStart();
      if (query.startsWith("INSERT INTO tags")) return [{ id: "550e8400-e29b-41d4-a716-446655440301" }];
      if (!query.startsWith("INSERT INTO pubs")) return [];
      insertIndex += 1;
      return insertIndex === 1 ? [{ id: "550e8400-e29b-41d4-a716-446655440201" }] : [];
    });

    await expect(
      importPubs("postgresql://example", [pub, { ...pub, id: "550e8400-e29b-41d4-a716-446655440202" }], sql),
    ).resolves.toEqual({
      imported: 1,
      skipped: 1,
      total: 2,
    });
  });

  it("requires a database URL and accepts the default source path", async () => {
    await expect(importPubs("", [pub])).rejects.toThrow("DATABASE_URL is required.");
    expect(getSourcePath([])).toBe("pubs.json");
    expect(() => getSourcePath(["first.json", "second.json"])).toThrow("Usage:");
  });
});
