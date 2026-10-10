/** RFC 9562 variant UUID v1〜v8を受け入れる共通Patternです。 */
export const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/**
 * 値がRFC 9562 variantのUUID version 1〜8形式かを判定します。
 * @param {unknown} value - 判定する未検証値。
 * @returns {value is string} UUID形式の文字列の場合はtrue。
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
