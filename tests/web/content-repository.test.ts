import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseMock = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  queries: [] as Array<{ text: string; values: unknown[] }>,
}));
vi.mock("@neondatabase/serverless", () => ({
  neon:
    () =>
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      databaseMock.queries.push({ text: strings.join("?"), values });
      return Promise.resolve(databaseMock.rows);
    },
}));
import {
  getPublishedContentBySlug,
  listPublishedContent,
  parsePublishedContent,
} from "../../apps/web/app/lib/content/repository";

const originalUrl = process.env.DATABASE_URL;
const row = {
  kind: "guide",
  slug: "sample",
  category: "culture",
  published_at: "2026-09-02T00:00:00.000Z",
  title: "サンプル",
  summary: "要約",
  body_markdown: "# 本文",
};
beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test-only";
  databaseMock.rows = [];
  databaseMock.queries = [];
});
afterEach(() => {
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
});

describe("editorial content repository", () => {
  it("公開済みContentだけをパラメータ化SQLとlocaleフォールバックで取得する", async () => {
    databaseMock.rows = [row];
    await expect(getPublishedContentBySlug("guide", "sample", "en")).resolves.toEqual({
      kind: "guide",
      slug: "sample",
      category: "culture",
      publishedAt: row.published_at,
      title: "サンプル",
      summary: "要約",
      bodyMarkdown: "# 本文",
    });
    expect(databaseMock.queries[0].text).toContain("entry.status = 'published'");
    expect(databaseMock.queries[0].values).toEqual(expect.arrayContaining(["en", "ja", "guide", "sample"]));
  });
  it("一覧を公開済みだけに限定しkind単位のcache tagを付与する", async () => {
    databaseMock.rows = [row];
    await expect(listPublishedContent("guide", "ja")).resolves.toHaveLength(1);
    expect(databaseMock.queries[0].text).toContain("ORDER BY entry.published_at DESC");
  });
  it("DB未設定時は接続せず公開Contentを返さない", async () => {
    delete process.env.DATABASE_URL;
    await expect(getPublishedContentBySlug("guide", "sample")).resolves.toBeNull();
    await expect(listPublishedContent("guide")).resolves.toEqual([]);
    expect(databaseMock.queries).toEqual([]);
  });
  it("Allow List外のDB値を拒否する", () => {
    expect(() => parsePublishedContent({ ...row, category: "other" })).toThrow("Invalid published content");
  });
});
