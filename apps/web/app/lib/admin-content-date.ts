import type { Locale } from "./i18n";

/**
 * Content管理一覧の日時を日本時間で表示します。
 * @param value ISO形式の日時。
 * @param locale 表示言語。
 * @returns Localeに応じて書式化した日本時間。
 */
export function formatAdminContentDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}
