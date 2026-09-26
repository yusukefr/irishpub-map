/**
 * 管理・Automation APIで共通の都道府県コードを検証します。
 * @param {string | null} value - Query Parameterの未検証値。
 * @returns {number | null} 1〜47のコード、または不正入力時のnull。
 */
export function parseMasterPrefectureCode(value: string | null): number | null {
  return value && /^(?:[1-9]|[1-3][0-9]|4[0-7])$/.test(value) ? Number(value) : null;
}
