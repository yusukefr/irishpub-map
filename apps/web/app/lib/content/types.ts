import type { ComponentType } from "react";

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
 * @param {string} value - 判定値。
 * @returns {boolean} 許可済みの場合はtrue。
 */
export function isContentKind(value: string): value is ContentKind {
  return CONTENT_KINDS.includes(value as ContentKind);
}
/**
 * 指定値が記事の許可済み分類かを判定します。
 * @param {string} value - 判定値。
 * @returns {boolean} 許可済みの場合はtrue。
 */
export function isContentCategory(value: string): value is ContentCategory {
  return CONTENT_CATEGORIES.includes(value as ContentCategory);
}
/** 公開画面で表示する翻訳済みEditorial Contentです。 */
export type PublishedContent = {
  slug: string;
  kind: ContentKind;
  title: string;
  summary: string;
  category: ContentCategory;
  publishedAt: string;
  bodyMarkdown: string;
};
/** Markdown Rendererへ渡す本文です。 */
export type ContentRendererProps = { markdown: string };
/** 許可済みkindと固定対応する本文Rendererです。 */
export type ContentRenderer = ComponentType<ContentRendererProps>;
