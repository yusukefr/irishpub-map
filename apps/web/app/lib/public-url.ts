// 公開先を固定し、Previewのhostや現在の検索条件・認証情報を共有しません。
const PUBLIC_ORIGIN = "https://irishpub-map-web.vercel.app";

/**
 * 公開店舗を開く正規URLを生成します。
 * @param {string} id 公開店舗ID。
 * @returns {string} 店舗詳細を開くMap URL。
 */
export function getPubUrl(id: string): string {
  return `${PUBLIC_ORIGIN}/?${new URLSearchParams({ pub: id })}`;
}

/**
 * 公開Guideの正規URLを生成します。
 * @param {string} slug 公開Guideのslug。
 * @returns {string} 公開Guide URL。
 */
export function getGuideUrl(slug: string): string {
  return `${PUBLIC_ORIGIN}/discover/guides/${encodeURIComponent(slug)}`;
}

/**
 * 公開Storyの正規URLを生成します。
 * @param {string} slug 公開Storyのslug。
 * @returns {string} 公開Story URL。
 */
export function getStoryUrl(slug: string): string {
  return `${PUBLIC_ORIGIN}/discover/stories/${encodeURIComponent(slug)}`;
}
