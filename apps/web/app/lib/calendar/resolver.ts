import type {
  CalendarDate,
  CalendarDateResolution,
  CalendarDateRule,
  CalendarEvent,
  CalendarEventOccurrence,
  CalendarWeekday,
  RuleSetCondition,
} from "./types";

function utcDate(date: CalendarDate): Date {
  const result = new Date(0);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCFullYear(date.year, date.month - 1, date.day);
  return result;
}

function calendarDate(date: Date): CalendarDate {
  return Object.freeze({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
}

function validDate(date: CalendarDate): CalendarDate {
  const parsed = utcDate(date);
  if (
    parsed.getUTCFullYear() !== date.year ||
    parsed.getUTCMonth() + 1 !== date.month ||
    parsed.getUTCDate() !== date.day
  ) {
    throw new Error(`Calendar date ${date.year}-${date.month}-${date.day} does not exist`);
  }
  return Object.freeze(date);
}

function single(date: CalendarDate): CalendarDateResolution {
  return Object.freeze({ status: "resolved", start: date, end: date });
}

function addDays(date: CalendarDate, amount: number): CalendarDate {
  const result = utcDate(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return calendarDate(result);
}

function dayOfWeek(date: CalendarDate): CalendarWeekday {
  return utcDate(date).getUTCDay() as CalendarWeekday;
}

function compareMonthDay(left: { month: number; day: number }, right: { month: number; day: number }): number {
  return left.month * 100 + left.day - (right.month * 100 + right.day);
}

function matchesCondition(condition: RuleSetCondition, year: number): boolean {
  if (condition.type === "otherwise") return true;
  return dayOfWeek(validDate({ year, month: condition.month, day: condition.day })) === condition.weekday;
}

/** グレゴリオ暦の復活祭日をMeeus/Jones/Butcher方式で算出します。
 * @param {number} year - 算出対象年。
 * @returns {CalendarDate} 復活祭の日付。
 */
export function getGregorianEasterDate(year: number): CalendarDate {
  if (!Number.isInteger(year) || year < 1583) throw new Error("Calendar year must be an integer of 1583 or later");
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Object.freeze({ year, month, day });
}

/** 日付ルールを指定年の具体的な期間、または未確定状態へ解決します。
 * @param {CalendarDateRule} rule - 検証済みの日付ルール。
 * @param {number} year - ルールを適用する開始年。
 * @returns {CalendarDateResolution} 解決済み期間または公式確認待ち状態。
 */
export function resolveDateRule(rule: CalendarDateRule, year: number): CalendarDateResolution {
  if (!Number.isInteger(year) || year < 1583) throw new Error("Calendar year must be an integer of 1583 or later");

  if (rule.type === "fixed") return single(validDate({ year, month: rule.month, day: rule.day }));
  if (rule.type === "date_range") {
    const endYear = compareMonthDay(rule.end, rule.start) < 0 ? year + 1 : year;
    return Object.freeze({
      status: "resolved",
      start: validDate({ year, ...rule.start }),
      end: validDate({ year: endYear, ...rule.end }),
    });
  }
  if (rule.type === "relative_to_easter") return single(addDays(getGregorianEasterDate(year), rule.offsetDays));
  if (rule.type === "annual_variable") {
    return Object.freeze({
      status: "unresolved",
      usualMonth: rule.usualMonth,
      requiresOfficialConfirmation: rule.requiresOfficialConfirmation,
    });
  }
  if (rule.type === "rule_set") {
    const selected = rule.rules.find(({ when }) => matchesCondition(when, year));
    if (!selected) throw new Error(`Calendar rule_set has no matching rule for ${year}`);
    return resolveDateRule(selected.use, year);
  }

  if (rule.type === "nth_weekday") {
    const first = Object.freeze({ year, month: rule.month, day: 1 });
    const day = 1 + ((rule.weekday - dayOfWeek(first) + 7) % 7) + (rule.nth - 1) * 7;
    const resolved = Object.freeze({ year, month: rule.month, day });
    if (utcDate(resolved).getUTCMonth() + 1 !== rule.month) {
      throw new Error(`The ${rule.nth} weekday ${rule.weekday} does not exist in ${year}-${rule.month}`);
    }
    return single(resolved);
  }

  if (rule.type === "last_weekday") {
    const lastDay = new Date(Date.UTC(year, rule.month, 0)).getUTCDate();
    const last = Object.freeze({ year, month: rule.month, day: lastDay });
    return single(addDays(last, -((dayOfWeek(last) - rule.weekday + 7) % 7)));
  }

  const base = validDate({ year, month: rule.month, day: rule.day });
  if (rule.type === "weekday_on_or_after") {
    return single(addDays(base, (rule.weekday - dayOfWeek(base) + 7) % 7));
  }

  const forward = (rule.weekday - dayOfWeek(base) + 7) % 7;
  const backward = (dayOfWeek(base) - rule.weekday + 7) % 7;
  // 同距離の場合は仕様どおり未来側を選びます。
  return single(addDays(base, forward <= backward ? forward : -backward));
}

/** イベントの日付ルールを指定年について解決します。
 * @param {CalendarEvent} event - 検証済みイベント。
 * @param {number} year - ルールを適用する開始年。
 * @returns {CalendarEventOccurrence} イベントを保持した解決結果。
 */
export function resolveCalendarEvent(event: CalendarEvent, year: number): CalendarEventOccurrence {
  return Object.freeze({ event, date: resolveDateRule(event.date, year) });
}

/** 2つの暦日を年月日の順に比較します。
 * @param {CalendarDate} left - 左辺の日付。
 * @param {CalendarDate} right - 右辺の日付。
 * @returns {number} 左辺が前なら負、同日なら0、後なら正。
 */
export function compareCalendarDates(left: CalendarDate, right: CalendarDate): number {
  return left.year * 10_000 + left.month * 100 + left.day - (right.year * 10_000 + right.month * 100 + right.day);
}
