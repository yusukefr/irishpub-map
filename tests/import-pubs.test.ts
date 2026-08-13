import { describe, expect, it, vi } from "vitest";
import { getSourcePath, importPubs, parsePubs } from "../scripts/import-pubs.mjs";

const pub = {
  id: "test-pub",
  name: "Test Pub",
  prefecture: "東京都",
  address: "東京都千代田区1-1-1",
  latitude: 35.68,
  longitude: 139.76,
  tags: ["guinness"],
  status: "open"
};

describe("parsePubs", () => {
  it("accepts valid pub data", () => {
    expect(parsePubs([pub])).toEqual([pub]);
  });

  it("rejects duplicate IDs and invalid records", () => {
    expect(() => parsePubs([pub, { ...pub, name: "Duplicate" }])).toThrow("Invalid pub data found.");
    expect(() => parsePubs([{ ...pub, status: "invalid" }])).toThrow("Invalid pub data found.");
  });
});

describe("importPubs", () => {
  it("inserts new records and skips existing IDs", async () => {
    let insertIndex = 0;
    const sql = vi.fn(async (strings: TemplateStringsArray) => {
      if (strings[0].startsWith("CREATE TABLE")) return [];
      insertIndex += 1;
      return insertIndex === 1 ? [{ id: "test-pub" }] : [];
    });

    await expect(importPubs("postgresql://example", [pub, { ...pub, id: "existing-pub" }], sql)).resolves.toEqual({
      imported: 1,
      skipped: 1,
      total: 2
    });
  });

  it("requires a database URL and accepts the default source path", async () => {
    await expect(importPubs("", [pub])).rejects.toThrow("DATABASE_URL is required.");
    expect(getSourcePath([])).toBe("pubs.json");
    expect(() => getSourcePath(["first.json", "second.json"])).toThrow("Usage:");
  });
});
