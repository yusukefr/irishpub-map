// タグ本体・日英翻訳・使用店舗数のtransactionと、使用中削除拒否をDBモック越しに保証します。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminTag, deleteAdminTag, getAdminTags, updateAdminTag } from "../../apps/web/app/lib/tag-repository";

const databaseMock = vi.hoisted(() => ({
  queries: [] as Array<{ text: string; values: unknown[] }>,
  responses: [] as Array<Array<Record<string, unknown>> | Error>,
  transactionCount: 0,
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const query = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      databaseMock.queries.push({ text, values });
      const response = databaseMock.responses.shift() ?? [];
      return response instanceof Error ? Promise.reject(response) : Promise.resolve(response);
    };
    query.transaction = async (callback: (transaction: typeof query) => Array<Promise<unknown>>) => {
      databaseMock.transactionCount += 1;
      return Promise.all(callback(query));
    };
    return query;
  },
}));

const originalDatabaseUrl = process.env.DATABASE_URL;
const tagRow = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  key: "whiskey",
  translations: { ja: "ウイスキー", en: "Whiskey" },
  pub_count: "2",
};

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test-only";
  databaseMock.queries = [];
  databaseMock.responses = [];
  databaseMock.transactionCount = 0;
});

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("tag repository", () => {
  it("returns an empty list without opening a connection when the database is not configured", async () => {
    delete process.env.DATABASE_URL;

    await expect(getAdminTags()).resolves.toEqual([]);
    expect(databaseMock.queries).toEqual([]);
  });

  it("returns Japanese, optional English, and distinct pub counts", async () => {
    databaseMock.responses = [
      [
        tagRow,
        { ...tagRow, id: "550e8400-e29b-41d4-a716-446655440002", translations: { ja: "ウイスキー" }, pub_count: 0 },
      ],
    ];

    await expect(getAdminTags()).resolves.toEqual([
      { id: tagRow.id, key: "whiskey", translations: { ja: "ウイスキー", en: "Whiskey" }, pubCount: 2 },
      { id: "550e8400-e29b-41d4-a716-446655440002", key: "whiskey", translations: { ja: "ウイスキー" }, pubCount: 0 },
    ]);
    expect(databaseMock.queries[0].text).toContain("COUNT(DISTINCT pub_tag.pub_id)");
  });

  it("creates Japanese and optional English translations in one transaction", async () => {
    databaseMock.responses = [[], [], [], []];

    const created = await createAdminTag({
      key: "craft-beer",
      translations: { ja: "クラフトビール", en: "Craft Beer" },
    });

    expect(created).toMatchObject({
      key: "craft-beer",
      translations: { ja: "クラフトビール", en: "Craft Beer" },
      pubCount: 0,
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(databaseMock.transactionCount).toBe(1);
    expect(databaseMock.queries.map(({ text }) => text)).toEqual([
      expect.stringContaining("SELECT tag.id"),
      expect.stringContaining("INSERT INTO tags"),
      expect.stringContaining("INSERT INTO tag_translations"),
      expect.stringContaining("INSERT INTO tag_translations"),
    ]);
  });

  it("updates display names without changing the key and removes empty English", async () => {
    databaseMock.responses = [[tagRow], [], [], []];

    await expect(updateAdminTag(tagRow.id, { translations: { ja: "新しい名前" } })).resolves.toEqual({
      id: tagRow.id,
      key: "whiskey",
      translations: { ja: "新しい名前" },
      pubCount: 2,
    });
    expect(databaseMock.transactionCount).toBe(1);
    expect(databaseMock.queries.at(-1)?.text).toContain("DELETE FROM tag_translations");
    expect(databaseMock.queries.every(({ text }) => !text.includes("UPDATE tags SET key"))).toBe(true);
  });

  it("maps application and database uniqueness conflicts to a conflict error", async () => {
    databaseMock.responses = [[{ id: tagRow.id }]];
    await expect(createAdminTag({ key: "whiskey", translations: { ja: "別名" } })).rejects.toMatchObject({
      code: "conflict",
    });

    const uniqueError = Object.assign(new Error("database detail"), { code: "23505" });
    databaseMock.responses = [[], uniqueError, [], []];
    await expect(createAdminTag({ key: "new-tag", translations: { ja: "新規" } })).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("rejects deleting an in-use tag without modifying pub relationships", async () => {
    databaseMock.responses = [[{ id: tagRow.id }], [{ pub_count: 2 }], []];

    await expect(deleteAdminTag(tagRow.id)).rejects.toMatchObject({ code: "in_use" });
    expect(databaseMock.transactionCount).toBe(1);
    expect(databaseMock.queries.some(({ text }) => text.includes("DELETE FROM pub_tags"))).toBe(false);
    expect(databaseMock.queries.some(({ text }) => text.includes("DELETE FROM pubs"))).toBe(false);
  });

  it("deletes an unused tag and distinguishes a missing tag", async () => {
    databaseMock.responses = [[{ id: tagRow.id }], [{ pub_count: 0 }], [{ id: tagRow.id }]];
    await expect(deleteAdminTag(tagRow.id)).resolves.toBeUndefined();

    databaseMock.responses = [[], [{ pub_count: 0 }], []];
    await expect(deleteAdminTag(tagRow.id)).rejects.toMatchObject({ code: "not_found" });
  });
});
