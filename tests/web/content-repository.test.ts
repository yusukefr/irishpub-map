import { describe, expect, it } from "vitest";
import type { MDXContent } from "mdx/types";
import {
  getContentLoaders,
  getContentSlugs,
  listContent,
  loadContent,
} from "../../apps/web/app/lib/content/repository";
import type { ContentArticleMetadata, ContentModule, ContentRegistry } from "../../apps/web/app/lib/content/types";

const ContentComponent = (() => null) as MDXContent;
const guideMetadata = {
  slug: "sample-guide",
  kind: "guide",
  title: "Sample Guide",
  summary: "A sample guide.",
  category: "culture",
  tags: ["guinness"],
  publishedAt: "2026-09-01",
} satisfies ContentArticleMetadata;

function createRegistry(
  metadata: ContentArticleMetadata,
  registrySlug = metadata.slug,
  entrySlug = registrySlug,
  entryKind: "guide" | "story" = "guide",
): ContentRegistry {
  const createModule = (): Promise<ContentModule> => Promise.resolve({ default: ContentComponent, metadata });
  return {
    story: {},
    guide: {
      [registrySlug]: {
        slug: entrySlug,
        kind: entryKind,
        loaders: {
          ja: createModule,
          en: createModule,
        },
      },
    },
  };
}

function createRegistryWithModule(contentModule: unknown): ContentRegistry {
  const loadModule = async () => contentModule as ContentModule;
  return {
    story: {},
    guide: {
      "sample-guide": {
        slug: "sample-guide",
        kind: "guide",
        loaders: { ja: loadModule, en: loadModule },
      },
    },
  };
}

describe("content repository", () => {
  it("exposes only explicitly registered own-property slugs", async () => {
    const registry = createRegistry(guideMetadata);

    expect(getContentSlugs("guide", registry)).toEqual(["sample-guide"]);
    expect(getContentLoaders("guide", "sample-guide", registry)).toBeDefined();

    for (const slug of ["toString", "constructor", "__proto__"]) {
      expect(getContentLoaders("guide", slug, registry)).toBeUndefined();
      await expect(loadContent("guide", slug, "en", registry)).resolves.toBeNull();
    }
  });

  it("loads locale-specific content and lists its metadata", async () => {
    const registry = createRegistry(guideMetadata);

    await expect(loadContent("guide", "sample-guide", "ja", registry)).resolves.toMatchObject({
      metadata: guideMetadata,
      Component: ContentComponent,
    });
    await expect(listContent("guide", "en", registry)).resolves.toEqual([guideMetadata]);
    await expect(loadContent("guide", "unknown", "en", registry)).resolves.toBeNull();
  });

  it.each([
    ["metadata missing", { default: ContentComponent }],
    ["invalid category", { default: ContentComponent, metadata: { ...guideMetadata, category: "other" } }],
    ["tags not array", { default: ContentComponent, metadata: { ...guideMetadata, tags: "guinness" } }],
    ["title not string", { default: ContentComponent, metadata: { ...guideMetadata, title: 123 } }],
    ["slug mismatch", { default: ContentComponent, metadata: { ...guideMetadata, slug: "other-guide" } }],
    ["kind mismatch", { default: ContentComponent, metadata: { ...guideMetadata, kind: "story" } }],
  ])("rejects invalid runtime metadata: %s", async (_caseName, contentModule) => {
    const registry = createRegistryWithModule(contentModule);

    await expect(loadContent("guide", "sample-guide", "ja", registry)).rejects.toThrow(
      "Invalid content module metadata",
    );
  });

  it("rejects a registry entry whose canonical fields do not match the route", async () => {
    const registry = createRegistry(guideMetadata, "sample-guide", "other-guide");

    await expect(loadContent("guide", "sample-guide", "ja", registry)).rejects.toThrow(
      "Content registry entry does not match the requested route",
    );
  });
});
