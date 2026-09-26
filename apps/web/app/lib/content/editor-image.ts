/**
 * Media参照のMarkdown画像を選択範囲へ挿入し、次のカーソル位置を返します。
 * @param {string} markdown - 現在の本文。
 * @param {number} start - 選択開始位置。
 * @param {number} end - 選択終了位置。
 * @param {string} id - Media Asset ID。
 * @param {string} alt - 本文言語の画像説明。
 * @returns {{markdown: string, caret: number}} 挿入後の本文とカーソル位置。
 */
export function insertMediaImageMarkdown(markdown: string, start: number, end: number, id: string, alt: string) {
  const escapedAlt = alt
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\\[\]]/g, "\\$&");
  const image = `![${escapedAlt}](/media/${id})`;
  const from = Math.max(0, Math.min(start, markdown.length));
  const to = Math.max(from, Math.min(end, markdown.length));
  return {
    markdown: markdown.slice(0, from) + image + markdown.slice(to),
    caret: from + image.length,
  };
}
