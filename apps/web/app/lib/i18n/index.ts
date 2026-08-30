import { normalizeTag } from "@irishpub-map/shared/tag";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@irishpub-map/shared/locale";
import ja from "./ja.json";
import en from "./en.json";

/** 利用者が明示選択した表示言語を保存するCookie名です。 */
export const LOCALE_COOKIE = "irishpub-map-locale";
/** 言語設定Cookieを保持する30日間の秒数です。 */
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
/** サポートlocaleごとの言語メニュー表示用国旗です。 */
const LANGUAGE_FLAGS = {
  ja: "🇯🇵",
  en: "🇬🇧",
} satisfies Record<Locale, string>;
/** 言語メニューを構成するロケールと国旗絵文字です。 */
export const LANGUAGE_OPTIONS = SUPPORTED_LOCALES.map((locale) => ({ locale, flag: LANGUAGE_FLAGS[locale] }));
/** 現在アプリケーションが提供する表示言語です。 */
export const LOCALES = SUPPORTED_LOCALES;
export { DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES } from "@irishpub-map/shared/locale";
export type { Locale } from "@irishpub-map/shared/locale";

/** 各言語JSONが持つ翻訳辞書の構造です。 */
export type Translation = typeof ja;
const translations = { ja, en } satisfies Record<Locale, Translation>;

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
  if (!language) return undefined;
  return LOCALES.find((locale) => language === locale || language.startsWith(`${locale}-`));
}

/**
 * 明示選択を優先して画面表示用のロケールを決定します。
 * @param {{ cookieLocale?: string | null; acceptLanguage?: string | null }} input - リクエストの言語情報。
 * @param {string | null | undefined} input.cookieLocale - 明示選択のCookie値。
 * @param {string | null | undefined} input.acceptLanguage - ブラウザの言語指定。
 * @returns {Locale} 表示するロケール。
 */
export function resolveLocale(input: { cookieLocale?: string | null; acceptLanguage?: string | null }): Locale {
  return parseLocale(input.cookieLocale) ?? parseLocale(input.acceptLanguage) ?? DEFAULT_LOCALE;
}

/**
 * Web APIのRequestから、画面と同じ優先順位で表示ロケールを決定します。
 * @param {Request} request - 言語CookieとAccept-Languageを含むリクエスト。
 * @returns {Locale} Cookieを優先して決定した表示ロケール。
 */
export function resolveRequestLocale(request: Request): Locale {
  const cookieLocale = request.headers
    .get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim().split("=", 2))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];

  return resolveLocale({ cookieLocale, acceptLanguage: request.headers.get("accept-language") });
}

/**
 * 指定したロケールの翻訳辞書を取得します。
 * @param {Locale} locale - 表示するロケール。
 * @returns {Translation} 翻訳辞書。
 */
export function getTranslation(locale: Locale) {
  return translations[locale];
}
