// 営業ステータスの日英翻訳取得とtransaction更新、固定key保護をDBモック越しに保証します。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminPubStatuses, updateAdminPubStatus } from "../../apps/web/app/lib/status-repository";

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
const statusRow = { code: 1, key: "open", name_ja: "営業中", name_en: "Open" };

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

describe("status repository", () => {
  it("returns an empty list without a configured database", async () => {
    delete process.env.DATABASE_URL;
    await expect(getAdminPubStatuses()).resolves.toEqual([]);
    expect(databaseMock.queries).toEqual([]);
  });

  it("returns fixed keys with Japanese and optional English names", async () => {
    databaseMock.responses = [[statusRow, { ...statusRow, code: "2", name_en: null }]];
    await expect(getAdminPubStatuses()).resolves.toEqual([
      { code: 1, key: "open", nameJa: "営業中", nameEn: "Open" },
      { code: 2, key: "open", nameJa: "営業中", nameEn: null },
    ]);
    expect(databaseMock.queries[0].text).toContain("pub_status_translations");
  });

  it("updates both translations in one transaction without changing the key", async () => {
    databaseMock.responses = [[statusRow], [], []];
    await expect(updateAdminPubStatus(1, { nameJa: "営業しています", nameEn: "Now Open" })).resolves.toEqual({
      code: 1,
      key: "open",
      nameJa: "営業しています",
      nameEn: "Now Open",
    });
    expect(databaseMock.transactionCount).toBe(1);
    expect(databaseMock.queries.map(({ text }) => text)).toEqual([
      expect.stringContaining("WHERE status.code"),
      expect.stringContaining("'ja'"),
      expect.stringContaining("'en'"),
    ]);
    expect(databaseMock.queries.every(({ text }) => !text.includes("UPDATE pub_statuses"))).toBe(true);
  });

  it("removes an empty English translation and rejects a missing status", async () => {
    databaseMock.responses = [[statusRow], [], []];
    await expect(updateAdminPubStatus(1, { nameJa: "営業中", nameEn: null })).resolves.toMatchObject({
      nameEn: null,
    });
    expect(databaseMock.queries.at(-1)?.text).toContain("DELETE FROM pub_status_translations");

    databaseMock.responses = [[]];
    await expect(updateAdminPubStatus(99, { nameJa: "不存在", nameEn: null })).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
