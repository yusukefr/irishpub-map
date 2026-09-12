import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseMock = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  queries: [] as Array<{ text: string; values: unknown[] }>,
}));

vi.mock("next/cache", () => ({
  unstable_cache: (query: () => Promise<unknown>) => () => query(),
}));
vi.mock("@neondatabase/serverless", () => ({
  neon:
    () =>
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      databaseMock.queries.push({ text: strings.join("?"), values });
      return Promise.resolve(databaseMock.rows);
    },
}));

import { getPublishedContentById } from "../../apps/web/app/lib/content/repository";

const originalDatabaseUrl = process.env.DATABASE_URL;
const id = "550e8400-e29b-41d4-a716-446655440001";

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test-only";
  databaseMock.rows = [];
  databaseMock.queries = [];
});

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("published content ID repository", () => {
  it("公開ContentだけをIDとLocale fallbackで取得する", async () => {
    databaseMock.rows = [
      {
        kind: "guide",
        slug: "irish-history",
        category: "history",
        published_at: "2026-09-12T00:00:00.000Z",
        title: "Irish history",
        summary: "Summary",
        body_markdown: "# Body",
      },
    ];

    await expect(getPublishedContentById(id, "en")).resolves.toMatchObject({
      kind: "guide",
      slug: "irish-history",
      title: "Irish history",
    });
    expect(databaseMock.queries[0].text).toContain("entry.status = 'published'");
    expect(databaseMock.queries[0].values).toEqual(expect.arrayContaining([id, "en", "ja"]));
    expect(databaseMock.queries[0].text).not.toContain(id);
  });

  it("不正IDとDB未設定時は問い合わせずnullを返す", async () => {
    await expect(getPublishedContentById("invalid", "ja")).resolves.toBeNull();
    delete process.env.DATABASE_URL;
    await expect(getPublishedContentById(id, "ja")).resolves.toBeNull();
    expect(databaseMock.queries).toEqual([]);
  });
});
