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
const splitTheGJaMetadata = {
  slug: "split-the-g",
  kind: "guide",
  title: "Split the Gを楽しむ",
  summary: "Guinnessのグラスを使ったPubの遊び「Split the G」を、安全に楽しむためのガイドです。",
  category: "pub-culture",
  tags: ["split-the-g", "guinness"],
  publishedAt: "2026-09-05",
} as const;
const splitTheGEnMetadata = {
  ...splitTheGJaMetadata,
  title: "How to Enjoy Split the G",
  summary: "A guide to enjoying the pub game Split the G with a Guinness glass, safely and at your own pace.",
} as const;

vi.mock("../../apps/web/content/discover/guides/sample/ja.mdx", () => ({
  default: ContentComponent,
  metadata: jaMetadata,
}));
vi.mock("../../apps/web/content/discover/guides/sample/en.mdx", () => ({
  default: ContentComponent,
  metadata: enMetadata,
}));
vi.mock("../../apps/web/content/discover/guides/split-the-g/ja.mdx", () => ({
  default: ContentComponent,
  metadata: splitTheGJaMetadata,
}));
vi.mock("../../apps/web/content/discover/guides/split-the-g/en.mdx", () => ({
  default: ContentComponent,
  metadata: splitTheGEnMetadata,
}));

import { contentRegistry } from "../../apps/web/app/lib/content/registry";
import { getContentSlugs, listContent, loadContent } from "../../apps/web/app/lib/content/repository";

describe("content registry", () => {
  it("Guideを明示登録し、日英Loaderをruntime validation経由で読み込む", async () => {
    expect(getContentSlugs("guide", contentRegistry)).toEqual(["split-the-g", "sample"]);

    await expect(loadContent("guide", "sample", "ja")).resolves.toMatchObject({ metadata: jaMetadata });
    await expect(loadContent("guide", "sample", "en")).resolves.toMatchObject({ metadata: enMetadata });
    await expect(loadContent("guide", "split-the-g", "ja")).resolves.toMatchObject({
      metadata: splitTheGJaMetadata,
    });
    await expect(loadContent("guide", "split-the-g", "en")).resolves.toMatchObject({
      metadata: splitTheGEnMetadata,
    });
    await expect(listContent("guide", "ja")).resolves.toEqual([splitTheGJaMetadata, jaMetadata]);
    await expect(listContent("guide", "en")).resolves.toEqual([splitTheGEnMetadata, enMetadata]);
  });
});
