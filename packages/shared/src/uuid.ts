const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * 値がRFC 4122のUUID version 1〜5形式かを判定します。
 * @param {unknown} value - 判定する未検証値。
 * @returns {value is string} UUID形式の文字列の場合はtrue。
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
