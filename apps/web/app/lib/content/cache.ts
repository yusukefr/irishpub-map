import { revalidateTag, unstable_cache } from "next/cache";
import type { ContentKind } from "@irishpub-map/shared/admin-content";
import type { Locale } from "@irishpub-map/shared/locale";

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
 * 公開Content個別取得をkind・slug・locale単位でキャッシュします。
 * @param {ContentKind} kind - Content種類。
 * @param {string} slug - Content slug。
 * @param {Locale} locale - 翻訳取得に使用するlocale。
 * @param {() => Promise<T>} query - キャッシュmiss時だけ実行する読み取り処理。
 * @returns {Promise<T>} キャッシュ済みまたは新規取得した結果。
 */
export function getCachedPublishedContent<T>(
  kind: ContentKind,
  slug: string,
  locale: Locale,
  query: () => Promise<T>,
): Promise<T> {
  return unstable_cache(query, ["published-content", kind, slug, locale], {
    tags: [getContentCacheTag(kind, slug)],
    revalidate: false,
  })();
}

/**
 * 公開Content一覧をkind・locale単位でキャッシュします。
 * @param {ContentKind} kind - Content種類。
 * @param {Locale} locale - 翻訳取得に使用するlocale。
 * @param {() => Promise<T>} query - キャッシュmiss時だけ実行する読み取り処理。
 * @returns {Promise<T>} キャッシュ済みまたは新規取得した結果。
 */
export function getCachedPublishedContentList<T>(
  kind: ContentKind,
  locale: Locale,
  query: () => Promise<T>,
): Promise<T> {
  return unstable_cache(query, ["published-content-list", kind, locale], {
    tags: [getContentListCacheTag(kind)],
    revalidate: false,
  })();
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
