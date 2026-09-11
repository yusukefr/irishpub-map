import {
  CONTENT_CATEGORIES,
  CONTENT_KINDS,
  CONTENT_STATUSES,
  isContentCategory,
  isContentKind,
  type ContentCategory,
  type ContentKind,
  type ContentStatus,
} from "@irishpub-map/shared/admin-content";
import type { ComponentType } from "react";

export { CONTENT_CATEGORIES, CONTENT_KINDS, CONTENT_STATUSES, isContentCategory, isContentKind };
export type { ContentCategory, ContentKind, ContentStatus };

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
/** 公開Content一覧で本文を除外した軽量な表示用メタデータです。 */
export type PublishedContentSummary = Omit<PublishedContent, "bodyMarkdown">;
/** Markdown Rendererへ渡す本文です。 */
export type ContentRendererProps = { markdown: string };
/** 許可済みkindと固定対応する本文Rendererです。 */
export type ContentRenderer = ComponentType<ContentRendererProps>;
