import type { MDXContent } from "mdx/types";
import type { Locale } from "../i18n";

/** Routingと表示形式で使う記事の種類です。 */
export type ContentKind = "story" | "guide";

/** 記事の内容上の分類です。 */
export type ContentCategory = "history" | "culture" | "pub-culture" | "food-drink";

/** 言語に依存しない記事タグの識別子です。 */
export type ContentTagId = string;

/** StoryとGuideで共有する記事メタデータです。 */
export type ContentArticleMetadata = {
  slug: string;
  kind: ContentKind;
  title: string;
  summary: string;
  category: ContentCategory;
  tags: readonly ContentTagId[];
  publishedAt: string;
};

/** MDX本文と、そのMDXからexportされる記事メタデータです。 */
export type ContentModule = {
  default: MDXContent;
  metadata: ContentArticleMetadata;
};

/** LocaleごとのTrusted MDXを遅延読み込みする関数です。 */
export type ContentLoader = () => Promise<ContentModule>;

/** 1記事の日本語・英語Loaderです。両方を必須にします。 */
export type ContentLocaleLoaders = Readonly<Record<Locale, ContentLoader>>;

/** Routeのkind、slug、localeを明示的に対応付けるAllow Listです。 */
export type ContentRegistry = Readonly<Record<ContentKind, Readonly<Record<string, ContentLocaleLoaders>>>>;
