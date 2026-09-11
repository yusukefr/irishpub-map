import { revalidateTag } from "next/cache";
import type { ContentKind } from "@irishpub-map/shared/admin-content";

/**
 * 公開Content個別取得で共有するキャッシュタグを返します。
 * @param {ContentKind} kind - Content種類。
 * @param {string} slug - Content slug。
 * @returns {string} 個別キャッシュタグ。
 */
export function getContentCacheTag(kind: ContentKind, slug: string) {
  return `content:${kind}:${slug}`;
}

/**
 * 公開Content一覧で共有するキャッシュタグを返します。
 * @param {ContentKind} kind - Content種類。
 * @returns {string} 一覧キャッシュタグ。
 */
export function getContentListCacheTag(kind: ContentKind) {
  return `content:list:${kind}`;
}

/**
 * 管理更新後に個別・一覧キャッシュを即時失効させます。
 * @param {ContentKind} kind - 更新対象の種類。
 * @param {string} slug - 更新対象のslug。
 * @returns {void}
 */
export function invalidateContentCache(kind: ContentKind, slug: string): void {
  revalidateTag(getContentCacheTag(kind, slug), { expire: 0 });
  revalidateTag(getContentListCacheTag(kind), { expire: 0 });
}
