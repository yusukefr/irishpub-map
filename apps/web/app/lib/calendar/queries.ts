import { calendarEvents } from "./data";
import { compareCalendarDates, resolveCalendarEvent } from "./resolver";
import type { CalendarDate, CalendarEvent, CalendarEventOccurrence } from "./types";

function isValidDate(date: CalendarDate): boolean {
  if (
    !Number.isInteger(date.year) ||
    date.year < 1583 ||
    !Number.isInteger(date.month) ||
    !Number.isInteger(date.day)
  ) {
    return false;
  }
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(date.year, date.month - 1, date.day);
  return (
    parsed.getUTCFullYear() === date.year && parsed.getUTCMonth() + 1 === date.month && parsed.getUTCDate() === date.day
  );
}

function overlaps(date: CalendarEventOccurrence["date"], start: CalendarDate, end: CalendarDate): boolean {
  return (
    date.status === "resolved" &&
    compareCalendarDates(date.start, end) <= 0 &&
    compareCalendarDates(date.end, start) >= 0
  );
}

function resolvedCandidates(event: CalendarEvent, year: number): readonly CalendarEventOccurrence[] {
  const current = resolveCalendarEvent(event, year);
  if (
    event.date.type !== "date_range" ||
    event.date.end.month * 100 + event.date.end.day >= event.date.start.month * 100 + event.date.start.day
  ) {
    return [current];
  }
  return [resolveCalendarEvent(event, year - 1), current];
}

/** `Date`をAsia/Tokyoの暦日に変換します。
 * @param {Date} now - 変換する時刻。省略時は現在時刻。
 * @returns {CalendarDate} 東京時間での年月日。
 */
export function getTodayInTokyo(now: Date = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return Object.freeze({ year: read("year"), month: read("month"), day: read("day") });
}

/** 指定日に重なる全イベントをJSON記載順で取得します。
 * @param {CalendarDate} date - 検索する暦日。
 * @param {readonly CalendarEvent[]} events - 検索対象。省略時は同梱JSONを使用します。
 * @returns {readonly CalendarEventOccurrence[]} 日付が確定し、指定日に重なるイベント。
 */
export function getEventsForDate(
  date: CalendarDate,
  events: readonly CalendarEvent[] = calendarEvents,
): readonly CalendarEventOccurrence[] {
  if (!isValidDate(date)) throw new Error("A valid calendar date of 1583 or later is required");
  return Object.freeze(
    events.flatMap((event) => {
      if (event.date.type === "annual_variable") return [];
      return resolvedCandidates(event, date.year)
        .filter((occurrence) => overlaps(occurrence.date, date, date))
        .slice(0, 1);
    }),
  );
}

/** 指定月に重なるイベントを開始日順、同日ならJSON記載順で取得します。
 * @param {number} year - 検索する年。
 * @param {number} month - 検索する月（1〜12）。
 * @param {readonly CalendarEvent[]} events - 検索対象。省略時は同梱JSONを使用します。
 * @returns {readonly CalendarEventOccurrence[]} 未確定日は通常月の末尾に含むイベント一覧。
 */
export function getEventsForMonth(
  year: number,
  month: number,
  events: readonly CalendarEvent[] = calendarEvents,
): readonly CalendarEventOccurrence[] {
  if (!Number.isInteger(year) || year < 1583 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("A valid year and month of 1583 or later are required");
  }
  const start = Object.freeze({ year, month, day: 1 });
  const end = Object.freeze({ year, month, day: new Date(Date.UTC(year, month, 0)).getUTCDate() });
  const indexed = events.flatMap((event, index) => {
    if (event.date.type === "annual_variable") {
      const occurrence = resolveCalendarEvent(event, year);
      return occurrence.date.status === "unresolved" && occurrence.date.usualMonth === month
        ? [{ occurrence, index }]
        : [];
    }
    const occurrence = resolvedCandidates(event, year).find((candidate) => overlaps(candidate.date, start, end));
    return occurrence ? [{ occurrence, index }] : [];
  });
  indexed.sort((left, right) => {
    if (left.occurrence.date.status === "unresolved")
      return right.occurrence.date.status === "unresolved" ? left.index - right.index : 1;
    if (right.occurrence.date.status === "unresolved") return -1;
    return compareCalendarDates(left.occurrence.date.start, right.occurrence.date.start) || left.index - right.index;
  });
  return Object.freeze(indexed.map(({ occurrence }) => occurrence));
}
