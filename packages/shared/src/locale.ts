/** サービスが表示・翻訳データでサポートするlocaleの一覧です。 */
export const SUPPORTED_LOCALES = ["ja", "en"] as const;

/** サポートするlocaleの型です。 */
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** サービスの既定表示localeです。 */
export const DEFAULT_LOCALE: Locale = "ja";

/** 管理データで必須とする翻訳localeです。 */
export const REQUIRED_TRANSLATION_LOCALE: Locale = "ja";

/**
 * 指定値がサポート済みlocaleかを判定します。
 * @param {string | null | undefined} value - 判定するlocale値。
 * @returns {value is Locale} サポート済みの場合はtrue。
 */
export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}
