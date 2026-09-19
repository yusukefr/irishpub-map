import { formatMessage, getTranslation, type Locale } from "../i18n";
import type { CalendarDateRuleDefinition } from "./types";

/** Calendar Date Ruleを管理画面で表示する人間向けの要約へ変換します。
 * @param rule
 * @param locale
 * @returns 日英のDate Rule要約。未設定時は未設定を返します。
 */
export function formatCalendarDateRuleSummary(rule: CalendarDateRuleDefinition | null, locale: Locale): string {
  const t = getTranslation(locale).admin.calendar;
  if (!rule) return t.notSet;

  if (rule.type === "fixed") {
    return formatMessage(t.dateRuleSummary.fixed, { month: monthName(rule.month, locale), day: rule.day });
  }
  if (rule.type === "date_range") {
    return formatMessage(t.dateRuleSummary.dateRange, {
      startMonth: monthName(rule.start.month, locale),
      startDay: rule.start.day,
      endMonth: monthName(rule.end.month, locale),
      endDay: rule.end.day,
    });
  }
  if (rule.type === "nth_weekday") {
    return formatMessage(t.dateRuleSummary.nthWeekday, {
      month: monthName(rule.month, locale),
      nth: rule.nth,
      weekday: t.weekdays[rule.weekday],
    });
  }
  if (rule.type === "last_weekday") {
    return formatMessage(t.dateRuleSummary.lastWeekday, {
      month: monthName(rule.month, locale),
      weekday: t.weekdays[rule.weekday],
    });
  }
  if (rule.type === "relative_to_easter") {
    const offsetDays = Math.abs(rule.offsetDays);
    const dayUnit = offsetDays === 1 ? t.dateRuleSummary.daySingular : t.dateRuleSummary.dayPlural;
    if (rule.offsetDays < 0) {
      return formatMessage(t.dateRuleSummary.relativeToEasterBefore, { offsetDays, dayUnit });
    }
    if (rule.offsetDays === 0) return t.dateRuleSummary.relativeToEasterSameDay;
    return formatMessage(t.dateRuleSummary.relativeToEasterAfter, { offsetDays, dayUnit });
  }
  if (rule.type === "weekday_on_or_after") {
    return formatMessage(t.dateRuleSummary.weekdayOnOrAfter, {
      month: monthName(rule.month, locale),
      day: rule.day,
      weekday: t.weekdays[rule.weekday],
    });
  }
  if (rule.type === "closest_weekday_to_date") {
    return formatMessage(t.dateRuleSummary.closestWeekdayToDate, {
      month: monthName(rule.month, locale),
      day: rule.day,
      weekday: t.weekdays[rule.weekday],
    });
  }
  if (rule.type === "annual_variable") {
    return formatMessage(t.dateRuleSummary.annualVariable, { month: monthName(rule.usualMonth, locale) });
  }
  if (rule.type === "rule_set") {
    return formatMessage(t.dateRuleSummary.ruleSet, { count: rule.rules.length });
  }
  return t.notSet;
}

function monthName(month: number, locale: Locale): string {
  const monthNames = getTranslation(locale).admin.calendar.monthNames;
  return monthNames[String(month) as keyof typeof monthNames];
}
