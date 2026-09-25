import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseMock = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  queries: [] as Array<{ text: string; values: unknown[] }>,
}));
vi.mock("next/cache", () => ({
  unstable_cache: (query: () => Promise<unknown>) => () => query(),
  revalidateTag: vi.fn(),
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
const originalE2ETestMode = process.env.E2E_TEST_MODE;
const row = {
  kind: "guide",
  slug: "sample",
  category: "culture",
  published_at: "2026-09-02T00:00:00.000Z",
  title: "サンプル",
  summary: "要約",
  body_markdown: "# 本文",
  hero_image_url: null,
  hero_image_width: null,
  hero_image_height: null,
  hero_image_alt: "",
  hero_image_caption: "",
};
beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test-only";
  databaseMock.rows = [];
  databaseMock.queries = [];
});
afterEach(() => {
  if (originalUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalUrl;
  if (originalE2ETestMode === undefined) delete process.env.E2E_TEST_MODE;
  else process.env.E2E_TEST_MODE = originalE2ETestMode;
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
      heroImage: null,
    });
    expect(databaseMock.queries[0].text).toContain("entry.status = 'published'");
    expect(databaseMock.queries[0].values).toEqual(expect.arrayContaining(["en", "ja", "guide", "sample"]));
  });
  it("一覧を公開済みだけに限定し本文を取得しない", async () => {
    databaseMock.rows = [row];
    await expect(listPublishedContent("guide", "ja")).resolves.toHaveLength(1);
    expect(databaseMock.queries[0].text).toContain("ORDER BY entry.published_at DESC");
    expect(databaseMock.queries[0].text).not.toContain("translation.body_markdown");
    expect(databaseMock.queries[0].text).not.toContain("hero_image_caption");
  });

  it("returns locale-specific hero metadata and omits caption from summaries", async () => {
    databaseMock.rows = [
      {
        ...row,
        hero_image_url: "https://sample.public.blob.vercel-storage.com/photo.jpg",
        hero_image_width: 1200,
        hero_image_height: 800,
        hero_image_alt: "Pub photo",
        hero_image_caption: "Photo credit",
      },
    ];
    await expect(getPublishedContentBySlug("guide", "sample", "en")).resolves.toMatchObject({
      heroImage: { alt: "Pub photo", caption: "Photo credit", width: 1200, height: 800 },
    });
    await expect(listPublishedContent("guide", "en")).resolves.toMatchObject([
      {
        heroImage: { alt: "Pub photo", width: 1200, height: 800 },
      },
    ]);
    const summary = await listPublishedContent("guide", "en");
    expect(summary[0].heroImage).not.toHaveProperty("caption");
    expect(summary[0].heroImage).not.toHaveProperty("storageKey");
  });
  it("DB未設定時は接続せず公開Contentを返さない", async () => {
    delete process.env.DATABASE_URL;
    await expect(getPublishedContentBySlug("guide", "sample")).resolves.toBeNull();
    await expect(listPublishedContent("guide")).resolves.toEqual([]);
    expect(databaseMock.queries).toEqual([]);
  });
  it("保存できない長さのslugはキャッシュやDBへ渡さず公開しない", async () => {
    await expect(getPublishedContentBySlug("guide", "a".repeat(101), "ja")).resolves.toBeNull();
    expect(databaseMock.queries).toEqual([]);
  });
  it("E2E専用fixtureでは公開Guideだけを返し、Draft slugを公開しない", async () => {
    process.env.E2E_TEST_MODE = "1";
    delete process.env.DATABASE_URL;

    await expect(getPublishedContentBySlug("guide", "split-the-g", "en")).resolves.toMatchObject({
      slug: "split-the-g",
      title: "How to Enjoy Split the G",
    });
    await expect(getPublishedContentBySlug("guide", "e2e-draft-guide", "ja")).resolves.toBeNull();
    await expect(listPublishedContent("guide", "ja")).resolves.toHaveLength(2);
    expect(databaseMock.queries).toEqual([]);
  });
  it("Allow List外のDB値を拒否する", () => {
    expect(() => parsePublishedContent({ ...row, category: "other" })).toThrow("Invalid published content");
  });
});
