import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from ".";

/**
 * 現在のリクエストから表示ロケールを取得します。
 * @returns {Promise<Locale>} Cookieまたはブラウザ設定から決定したロケール。
 */
export async function getRequestLocale(): Promise<Locale> {
  const [requestCookies, requestHeaders] = await Promise.all([cookies(), headers()]);

  return resolveLocale({
    cookieLocale: requestCookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: requestHeaders.get("accept-language"),
  });
}
