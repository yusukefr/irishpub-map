import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAdminContent,
  insertAdminContent,
  replaceAdminContent,
  setAdminContentPublication,
} from "../../apps/web/app/lib/admin-content-repository";

const databaseMock = vi.hoisted(() => ({
  queries: [] as Array<{ text: string; values: unknown[] }>,
  responses: [] as Array<Array<Record<string, unknown>>>,
  transactionCount: 0,
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const query = (strings: TemplateStringsArray, ...values: unknown[]) => {
      databaseMock.queries.push({ text: strings.join("?"), values });
      return Promise.resolve(databaseMock.responses.shift() ?? []);
    };
    query.transaction = async (callback: (transaction: typeof query) => Array<Promise<unknown>>) => {
      databaseMock.transactionCount += 1;
      return Promise.all(callback(query));
    };
    return query;
  },
}));

const originalDatabaseUrl = process.env.DATABASE_URL;
const id = "550e8400-e29b-41d4-a716-446655440001";
const input = {
  kind: "guide" as const,
  slug: "pub-etiquette",
  category: "pub-culture" as const,
  heroImageAssetId: null,
  translations: {
    ja: { title: "パブの作法", summary: "要約", bodyMarkdown: "# 本文", heroImageAlt: "", heroImageCaption: "" },
    en: { title: "Pub etiquette", summary: "Summary", bodyMarkdown: "# Body", heroImageAlt: "", heroImageCaption: "" },
  },
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

describe("admin content repository", () => {
  it("returns incomplete draft fields and both locale translations", async () => {
    databaseMock.responses = [
      [
        {
          id,
          kind: null,
          slug: null,
          category: null,
          status: "draft",
          published_at: null,
          created_at: "2026-09-11T00:00:00.000Z",
          updated_at: "2026-09-11T01:00:00.000Z",
          title_ja: "下書き",
          summary_ja: "",
          body_markdown_ja: "",
          hero_image_alt_ja: "",
          hero_image_caption_ja: "",
          title_en: "",
          summary_en: "",
          body_markdown_en: "",
          hero_image_alt_en: "",
          hero_image_caption_en: "",
          hero_image_asset_id: null,
          hero_image_url: null,
        },
      ],
    ];
    await expect(getAdminContent(id)).resolves.toMatchObject({
      id,
      kind: null,
      slug: null,
      category: null,
      status: "draft",
      heroImageAssetId: null,
      heroImage: null,
      translations: {
        ja: { title: "下書き", summary: "", bodyMarkdown: "" },
        en: { title: "", summary: "", bodyMarkdown: "" },
      },
    });
    expect(databaseMock.queries[0].text).toContain("LEFT JOIN content_translations AS en");
  });

  it("creates the entry and both translations in one parameterized transaction", async () => {
    databaseMock.responses = [[], [], []];
    await insertAdminContent(id, input);

    expect(databaseMock.transactionCount).toBe(1);
    expect(databaseMock.queries.map(({ text }) => text)).toEqual([
      expect.stringContaining("INSERT INTO content_entries"),
      expect.stringContaining("INSERT INTO content_translations"),
      expect.stringContaining("INSERT INTO content_translations"),
    ]);
    expect(databaseMock.queries[0].values).toContain(input.slug);
    expect(databaseMock.queries.map(({ text }) => text).join("\n")).not.toContain(input.slug);
  });

  it("locks updates and prevents translations changing when a published update is incomplete", async () => {
    databaseMock.responses = [[{ kind: "guide", slug: "old", status: "published" }], [], [], []];

    await expect(replaceAdminContent(id, { ...input, slug: null }, false)).resolves.toEqual({
      code: "publication_blocked",
    });
    expect(databaseMock.transactionCount).toBe(1);
    expect(databaseMock.queries[0].text).toContain("FOR UPDATE");
    expect(databaseMock.queries[1].text).toContain("entry.status = 'draft' OR");
    expect(databaseMock.queries[2].text).toContain("WHERE EXISTS");
  });

  it("checks both locales inside the publication transaction", async () => {
    databaseMock.responses = [
      [{ kind: "guide", slug: "pub-etiquette", status: "draft", published_at: null }],
      [
        {
          id,
          kind: "guide",
          slug: "pub-etiquette",
          status: "published",
          published_at: "2026-09-11T02:30:00.000Z",
        },
      ],
    ];

    await expect(setAdminContentPublication(id, "published")).resolves.toEqual({
      id,
      status: "published",
      unchanged: false,
      publishedAt: "2026-09-11T02:30:00.000Z",
      identity: { kind: "guide", slug: "pub-etiquette" },
    });
    expect(databaseMock.queries[0].text).toContain("FOR UPDATE");
    expect(databaseMock.queries[1].text).toContain("(VALUES ('ja'), ('en'))");
    expect(databaseMock.queries[1].text).toContain("btrim(translation.body_markdown)");
    expect(databaseMock.queries[1].text).toContain("btrim(translation.hero_image_alt)");
  });

  it("resolves an existing hero without exposing its storage key", async () => {
    const heroId = "550e8400-e29b-41d4-a716-446655440009";
    databaseMock.responses = [
      [
        {
          id,
          kind: "guide",
          slug: "pub-etiquette",
          category: "pub-culture",
          status: "draft",
          published_at: null,
          created_at: "2026-09-11T00:00:00.000Z",
          updated_at: "2026-09-11T01:00:00.000Z",
          title_ja: "パブの作法",
          summary_ja: "要約",
          body_markdown_ja: "本文",
          hero_image_alt_ja: "写真",
          hero_image_caption_ja: "出典",
          title_en: "Pub etiquette",
          summary_en: "Summary",
          body_markdown_en: "Body",
          hero_image_alt_en: "Photo",
          hero_image_caption_en: "Credit",
          hero_image_asset_id: heroId,
          hero_image_url: "https://example.public.blob.vercel-storage.com/photo.jpg",
          hero_image_mime_type: "image/jpeg",
          hero_image_width: 1200,
          hero_image_height: 800,
          hero_image_file_size: 1000,
          hero_image_created_at: "2026-09-11T00:00:00.000Z",
        },
      ],
    ];
    const content = await getAdminContent(id);
    expect(content).toMatchObject({
      heroImageAssetId: heroId,
      heroImage: { id: heroId, width: 1200, height: 800 },
      translations: {
        ja: { heroImageAlt: "写真", heroImageCaption: "出典" },
        en: { heroImageAlt: "Photo", heroImageCaption: "Credit" },
      },
    });
    expect(content?.heroImage).not.toHaveProperty("storageKey");
    expect(databaseMock.queries[0].text).toContain("LEFT JOIN media_assets");
    expect(databaseMock.queries[0].text).not.toContain("storage_key");
  });
});
