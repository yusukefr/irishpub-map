import type { ContentKind, ContentRenderer } from "./types";
import { GuideRenderer, StoryRenderer } from "./renderer";
/** DBのkindを許可済みRendererへ固定対応させるAllow Listです。 */
export const contentRegistry = { story: {}, guide: { "split-the-g": {}, sample: {} } } as const;

export const contentRendererRegistry = { guide: GuideRenderer, story: StoryRenderer } satisfies Record<
  ContentKind,
  ContentRenderer
>;
/**
 * DB値をComponent名やimport pathとして解決せず、固定登録されたRendererを返します。
 * @param {ContentKind} kind - 許可済み記事種別。
 * @returns {ContentRenderer} 固定登録されたRenderer。
 */
export function getContentRenderer(kind: ContentKind): ContentRenderer {
  return contentRendererRegistry[kind];
}
