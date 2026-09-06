import type { MDXContent } from "mdx/types";
import type { Locale } from "@irishpub-map/shared/locale";
import type { ContentCategory, ContentKind } from "./types";

type LegacyContent = {
  Component: MDXContent;
  metadata: {
    slug: string;
    kind: ContentKind;
    title: string;
    summary: string;
    category: ContentCategory;
    publishedAt: string;
  };
};
type LegacyModule = { default: MDXContent; metadata: LegacyContent["metadata"] };
const guideLoaders: Record<string, Record<Locale, () => Promise<LegacyModule>>> = {
  "split-the-g": {
    ja: () => import("../../../content/discover/guides/split-the-g/ja.mdx"),
    en: () => import("../../../content/discover/guides/split-the-g/en.mdx"),
  },
  sample: {
    ja: () => import("../../../content/discover/guides/sample/ja.mdx"),
    en: () => import("../../../content/discover/guides/sample/en.mdx"),
  },
};
/**
 * 既存MDX Guideを固定Allow Listから読み込みます。
 * @param {string} slug - 固定Allow Listに登録したGuideのslug。
 * @param {Locale} locale - 表示に使用するlocale。
 * @returns {Promise<LegacyContent | null>} 読み込み済みのGuide。未登録時はnull。
 */
export async function loadLegacyGuide(slug: string, locale: Locale): Promise<LegacyContent | null> {
  const loader = guideLoaders[slug]?.[locale];
  if (!loader) return null;
  const contentModule = await loader();
  return { Component: contentModule.default, metadata: contentModule.metadata };
}
/**
 * 既存MDX Guideの一覧メタデータを取得します。
 * @param {Locale} locale - 表示に使用するlocale。
 * @returns {Promise<readonly LegacyContent["metadata"][]>} 一覧表示用のGuideメタデータ。
 */
export async function listLegacyGuides(locale: Locale): Promise<readonly LegacyContent["metadata"][]> {
  return Promise.all(
    Object.keys(guideLoaders).map(async (slug) => (await loadLegacyGuide(slug, locale))?.metadata),
  ).then((values) => values.filter((value): value is LegacyContent["metadata"] => Boolean(value)));
}
