import { describe, expect, it, vi } from "vitest";
import type { MDXContent } from "mdx/types";

const ContentComponent = (() => null) as MDXContent;
const jaMetadata = {
  slug: "sample",
  kind: "guide",
  title: "サンプルガイド",
  summary: "Explore Irelandセクション用のサンプルコンテンツです。",
  category: "culture",
  tags: ["sample"],
  publishedAt: "2026-09-02",
} as const;
const enMetadata = {
  ...jaMetadata,
  title: "Sample Guide",
  summary: "Sample content for the Explore Ireland section.",
} as const;

vi.mock("../../apps/web/content/discover/guides/sample/ja.mdx", () => ({
  default: ContentComponent,
  metadata: jaMetadata,
}));
vi.mock("../../apps/web/content/discover/guides/sample/en.mdx", () => ({
  default: ContentComponent,
  metadata: enMetadata,
}));

import { contentRegistry } from "../../apps/web/app/lib/content/registry";
import { getContentSlugs, listContent, loadContent } from "../../apps/web/app/lib/content/repository";

describe("sample content registry", () => {
  it("sample Guideを明示登録し、日英Loaderをruntime validation経由で読み込む", async () => {
    expect(getContentSlugs("guide", contentRegistry)).toEqual(["sample"]);

    await expect(loadContent("guide", "sample", "ja")).resolves.toMatchObject({ metadata: jaMetadata });
    await expect(loadContent("guide", "sample", "en")).resolves.toMatchObject({ metadata: enMetadata });
    await expect(listContent("guide", "ja")).resolves.toEqual([jaMetadata]);
    await expect(listContent("guide", "en")).resolves.toEqual([enMetadata]);
  });
});
