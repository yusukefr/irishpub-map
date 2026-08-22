import { normalizeTag } from "@irishpub-map/shared/tag";
import ja from "./ja.json";
import en from "./en.json";

/** 利用者が明示選択した表示言語を保存するCookie名です。 */
export const LOCALE_COOKIE = "irishpub-map-locale";
/** 言語設定Cookieを保持する30日間の秒数です。 */
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
/** 言語メニューを構成するロケールと国旗絵文字です。 */
export const LANGUAGE_OPTIONS = [
  { locale: "ja", flag: "🇯🇵" },
  { locale: "en", flag: "🇬🇧" },
] as const;
/** サポート済みの表示言語コードです。 */
export type Locale = (typeof LANGUAGE_OPTIONS)[number]["locale"];
/** 現在アプリケーションが提供する表示言語です。 */
export const LOCALES: readonly Locale[] = LANGUAGE_OPTIONS.map(({ locale }) => locale);
/** API・Repositoryで受け付ける表示ロケールです。 */
export const SUPPORTED_LOCALES = LOCALES;

/**
 * 指定値が現在サポートする表示ロケールかを判定します。
 *  {string | null | undefined} value - 判定するロケール値。
 *  {value is Locale} サポート対象の場合はtrue。
 */
export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}

/** 各言語JSONが持つ翻訳辞書の構造です。 */
export type Translation = typeof ja;
const translations: Record<Locale, Translation> = { ja, en };

/**
 * JSON内のプレースホルダーへ値を補間します。
 * @param {string} message - {name}形式のプレースホルダーを含む文言。
 * @param {Record<string, string | number>} values - 補間する値。
 * @returns {string} 補間後の文言。
 */
export function formatMessage(message: string, values: Record<string, string | number>) {
  return message.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ""));
}

/**
 * タグIDを選択言語の表示名へ変換します。
 * @param {Locale} locale - 表示言語。
 * @param {string} tag - タグID。
 * @returns {string} 翻訳済みの表示名、または未知のタグID。
 */
export function getTagLabel(locale: Locale, tag: string) {
  const normalized = normalizeTag(tag) as keyof Translation["list"]["tagLabels"];
  return translations[locale].list.tagLabels[normalized] ?? tag;
}

/**
 * CookieまたはAccept-Languageの値から対応するロケールを取得します。
 * @param {string | null | undefined} value - 解析対象の言語指定。
 * @returns {Locale | undefined} 対応するロケール。
 */
export function parseLocale(value: string | null | undefined): Locale | undefined {
  const language = value?.toLowerCase().split(",")[0]?.trim();
  return language?.startsWith("en") ? "en" : language?.startsWith("ja") ? "ja" : undefined;
}

/**
 * 明示選択を優先して画面表示用のロケールを決定します。
 * @param {{ cookieLocale?: string | null; acceptLanguage?: string | null }} input - リクエストの言語情報。
 * @param {string | null | undefined} input.cookieLocale - 明示選択のCookie値。
 * @param {string | null | undefined} input.acceptLanguage - ブラウザの言語指定。
 * @returns {Locale} 表示するロケール。
 */
export function resolveLocale(input: { cookieLocale?: string | null; acceptLanguage?: string | null }): Locale {
  return parseLocale(input.cookieLocale) ?? parseLocale(input.acceptLanguage) ?? "ja";
}

/**
 * 指定したロケールの翻訳辞書を取得します。
 * @param {Locale} locale - 表示するロケール。
 * @returns {Translation} 翻訳辞書。
 */
export function getTranslation(locale: Locale) {
  return translations[locale];
}
