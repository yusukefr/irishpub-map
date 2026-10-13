import { SUPPORTED_LOCALES, type Locale } from "@irishpub-map/shared/locale";

/** 公開店舗API Queryの検証結果。 */
export type PublicPubsQueryResult =
  { ok: true; locale: Locale | null } | { ok: false; error: "Unsupported query parameter." | "Unsupported locale." };

/**
 * 公開店舗APIの元Query文字列を検証します。
 * @param {string} requestUrl - リクエストURL。
 * @returns {PublicPubsQueryResult} locale、または入力エラー。
 */
export function parsePublicPubsQuery(requestUrl: string): PublicPubsQueryResult {
  const queryStart = requestUrl.indexOf("?");
  if (queryStart < 0 || queryStart === requestUrl.length - 1) return { ok: true, locale: null };
  const search = requestUrl.slice(queryStart);

  const requestedLocale = /^\?locale=([^&%+]+)$/.exec(search)?.[1];
  if (requestedLocale === undefined) return { ok: false, error: "Unsupported query parameter." };
  const locale = SUPPORTED_LOCALES.find((supportedLocale) => supportedLocale === requestedLocale);
  if (locale === undefined) return { ok: false, error: "Unsupported locale." };

  return { ok: true, locale };
}
