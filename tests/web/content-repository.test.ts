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

function createRegistry(metadata: ContentArticleMetadata, registrySlug = metadata.slug): ContentRegistry {
  const createModule = (): Promise<ContentModule> => Promise.resolve({ default: ContentComponent, metadata });
  return {
    story: {},
    guide: {
      [registrySlug]: {
        ja: createModule,
        en: createModule,
      },
    },
  };
}

describe("content repository", () => {
  it("exposes only explicitly registered slugs", () => {
    const registry = createRegistry(guideMetadata);

    expect(getContentSlugs("guide", registry)).toEqual(["sample-guide"]);
    expect(getContentLoaders("guide", "sample-guide", registry)).toBeDefined();
    expect(getContentLoaders("guide", "unknown", registry)).toBeUndefined();
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

  it("rejects metadata that does not match the registry slug or kind", async () => {
    const registry = createRegistry({ ...guideMetadata, slug: "other-guide" }, "sample-guide");

    await expect(loadContent("guide", "sample-guide", "ja", registry)).rejects.toThrow(
      "Content metadata does not match the registry entry",
    );
  });
});
