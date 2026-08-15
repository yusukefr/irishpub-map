const TAG_LABELS: Record<string, string> = {
  guinness: "ギネス",
  food: "食事あり",
  "station-area": "駅近",
  "craft-beer": "クラフトビール",
  "live-music": "ライブ音楽",
};

/**
 * 既知のタグIDを日本語表示名へ変換し、未知のタグはIDをそのまま返します。
 * @param {string} tagId - 表示するタグID。
 * @returns {string} 日本語表示名、または未知の場合のタグID。
 */
export function getTagLabel(tagId: string) {
  return TAG_LABELS[tagId] ?? tagId;
}
