import type { AdminCalendarEvent, AdminCalendarWriteInput } from "./types";

/**
 * 保存済みCalendar Eventの公開不足フィールドを返します。
 * @param input
 * @returns 公開に不足するフィールド一覧。
 */
export function getCalendarPublicationMissingFields(input: AdminCalendarEvent | AdminCalendarWriteInput): string[] {
  const missing: string[] = [];
  if (!input.category) missing.push("category");
  if (!input.dateRule) missing.push("dateRule");
  for (const locale of ["ja", "en"] as const) {
    const translation = input.translations[locale];
    if (!translation.name.trim()) missing.push("translations." + locale + ".name");
  }
  return missing;
}
