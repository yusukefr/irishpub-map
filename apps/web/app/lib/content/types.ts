import type { MDXContent } from "mdx/types";
import type { Locale } from "../i18n";

/** Routingと表示形式で使う記事の種類です。 */
export const CONTENT_KINDS = ["story", "guide"] as const;

/** Routingと表示形式で使う記事の種類です。 */
export type ContentKind = (typeof CONTENT_KINDS)[number];

/** 記事の内容上の分類です。 */
export const CONTENT_CATEGORIES = ["history", "culture", "pub-culture", "food-drink"] as const;

/** 記事の内容上の分類です。 */
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

/** DBに保存する記事の公開状態です。 */
export const CONTENT_STATUSES = ["draft", "published"] as const;

/** DBに保存する記事の公開状態です。 */
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/**
 * 指定値が記事の許可済み種類かを判定します。
 * @param {string} value - 判定する種類。
 * @returns {value is ContentKind} 許可済み種類の場合はtrue。
 */
export function isContentKind(value: string): value is ContentKind {
  return CONTENT_KINDS.includes(value as ContentKind);
}

/**
 * 指定値が記事の許可済み分類かを判定します。
 * @param {string} value - 判定する分類。
 * @returns {value is ContentCategory} 許可済み分類の場合はtrue。
 */
export function isContentCategory(value: string): value is ContentCategory {
  return CONTENT_CATEGORIES.includes(value as ContentCategory);
}

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

/** Registry上のslugとkind、および日英Loaderを束ねるEntryです。 */
export type ContentRegistryEntry = {
  slug: string;
  kind: ContentKind;
  loaders: ContentLocaleLoaders;
};

/** Routeのkind、slug、localeを明示的に対応付けるAllow Listです。 */
export type ContentRegistry = Readonly<Record<ContentKind, Readonly<Record<string, ContentRegistryEntry>>>>;
