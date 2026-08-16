import definitions from "./tag-definitions.json";

const TAG_LABELS: Record<string, string> = definitions.canonical;
const TAG_ALIASES: Record<string, string> = definitions.aliases;

function normalizeTagText(tag: string) {
  return tag
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * タグの入力値を共有する内部キーへ変換します。意味が変わる別名は定義表に明示したものだけを統合します。
 * @param {string} tag - 正規化するタグ。
 * @returns {string} 正規化されたタグID。
 */
export function normalizeTag(tag: string) {
  const normalized = normalizeTagText(tag);
  return TAG_ALIASES[normalized] ?? TAG_ALIASES[tag.trim()] ?? normalized;
}

/**
 * タグ配列を正規化し、店舗内の重複を除去します。
 * @param {string[]} tags - 正規化するタグ配列。
 * @returns {string[]} 正規化され、重複を除いたタグID配列。
 */
export function normalizeTags(tags: string[]) {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))];
}

/**
 * 既知のタグIDを日本語表示名へ変換し、未知のタグはIDをそのまま返します。
 * @param {string} tagId - 表示するタグID。
 * @returns {string} 日本語表示名、または未知の場合のタグID。
 */
export function getTagLabel(tagId: string) {
  const normalized = normalizeTag(tagId);
  return TAG_LABELS[normalized] ?? tagId;
}
