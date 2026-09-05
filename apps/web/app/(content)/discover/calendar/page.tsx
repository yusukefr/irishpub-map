import type { Metadata } from "next";
import Link from "next/link";
import { calendarData } from "../../../lib/calendar/data";
import { getEventsForDate, getEventsForMonth, getTodayInTokyo } from "../../../lib/calendar/queries";
import type { CalendarDate, CalendarEventOccurrence } from "../../../lib/calendar/types";
import { formatMessage, getTranslation, type Locale } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

const CALENDAR_MONTH_RANGE = 12;

type CalendarPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type YearMonth = Pick<CalendarDate, "year" | "month">;

function toMonthIndex({ year, month }: YearMonth): number {
  return year * 12 + month - 1;
}

function fromMonthIndex(monthIndex: number): YearMonth {
  return {
    year: Math.floor(monthIndex / 12),
    month: (monthIndex % 12) + 1,
  };
}

function parseQueryInteger(value: string | string[] | undefined): number | null {
  if (typeof value !== "string" || !/^\d+$/u.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** 不正値や閲覧可能範囲外を当月へ戻し、安全に表示対象月を決定します。 */
function resolveSelectedMonth(
  searchParams: Record<string, string | string[] | undefined>,
  currentMonth: YearMonth,
): YearMonth {
  const year = parseQueryInteger(searchParams.year);
  const month = parseQueryInteger(searchParams.month);
  if (year === null || month === null || month < 1 || month > 12) {
    return currentMonth;
  }

  const selectedMonth = { year, month };
  const selectedMonthIndex = toMonthIndex(selectedMonth);
  const currentMonthIndex = toMonthIndex(currentMonth);
  if (
    !Number.isSafeInteger(selectedMonthIndex) ||
    Math.abs(selectedMonthIndex - currentMonthIndex) > CALENDAR_MONTH_RANGE
  ) {
    return currentMonth;
  }

  return selectedMonth;
}

function getCalendarHref({ year, month }: YearMonth): string {
  return `/discover/calendar?year=${year}&month=${month}`;
}

function toUtcDate(date: CalendarDate): Date {
  const result = new Date(0);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCFullYear(date.year, date.month - 1, date.day);
  return result;
}

function formatDate(date: CalendarDate, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(
    toUtcDate(date),
  );
}

function formatMonth(year: number, month: number, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "long" }).format(
    toUtcDate({ year, month, day: 1 }),
  );
}

function formatOccurrenceDate(occurrence: CalendarEventOccurrence, locale: Locale): string {
  if (occurrence.date.status === "unresolved") {
    return getTranslation(locale).discover.calendar.dateToBeConfirmed;
  }
  const start = formatDate(occurrence.date.start, locale);
  return occurrence.date.start.year === occurrence.date.end.year &&
    occurrence.date.start.month === occurrence.date.end.month &&
    occurrence.date.start.day === occurrence.date.end.day
    ? start
    : `${start} – ${formatDate(occurrence.date.end, locale)}`;
}

function EventList({ events, locale }: { events: readonly CalendarEventOccurrence[]; locale: Locale }) {
  return (
    <ul className="calendar-event-list">
      {events.map((occurrence) => (
        <li className="calendar-event-card" key={occurrence.event.id}>
          <div className="calendar-event-meta">
            <time>{formatOccurrenceDate(occurrence, locale)}</time>
            <span>{calendarData.categories[occurrence.event.category][locale]}</span>
          </div>
          <h3>{occurrence.event.name[locale]}</h3>
          <p>{occurrence.event.description[locale]}</p>
        </li>
      ))}
    </ul>
  );
}

/** 選択言語に対応するIrish Calendarのメタデータを生成します。
 * @returns {Promise<Metadata>} ページのtitleとdescription。
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = getTranslation(await getRequestLocale()).discover.calendar;
  return { title: `${t.heading} | Irish Pub Map`, description: t.lead };
}

/** Asia/Tokyo基準の当日と、選択月に該当するアイルランドのイベントを表示します。
 * @param {CalendarPageProps} props Next.jsから渡されるクエリパラメータ。
 * @returns {Promise<JSX.Element>} 日英ローカライズ済みのカレンダーページ。
 */
export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const [locale, resolvedSearchParams] = await Promise.all([getRequestLocale(), searchParams]);
  const t = getTranslation(locale).discover.calendar;
  const today = getTodayInTokyo();
  const currentMonth = { year: today.year, month: today.month };
  const selectedMonth = resolveSelectedMonth(resolvedSearchParams, currentMonth);
  const currentMonthIndex = toMonthIndex(currentMonth);
  const selectedMonthIndex = toMonthIndex(selectedMonth);
  const previousMonth =
    selectedMonthIndex > currentMonthIndex - CALENDAR_MONTH_RANGE ? fromMonthIndex(selectedMonthIndex - 1) : null;
  const nextMonth =
    selectedMonthIndex < currentMonthIndex + CALENDAR_MONTH_RANGE ? fromMonthIndex(selectedMonthIndex + 1) : null;
  const todaysEvents = getEventsForDate(today);
  const monthlyEvents = getEventsForMonth(selectedMonth.year, selectedMonth.month);

  return (
    <article className="content-container calendar-page" aria-labelledby="calendar-heading">
      <header className="content-hero">
        <p className="content-kicker">{t.kicker}</p>
        <h1 id="calendar-heading">{t.heading}</h1>
        <p className="content-lead">{t.lead}</p>
      </header>

      <section className="calendar-section" aria-labelledby="calendar-today-heading">
        <h2 id="calendar-today-heading">{t.todayHeading}</h2>
        {todaysEvents.length > 0 ? (
          <EventList events={todaysEvents} locale={locale} />
        ) : (
          <p className="calendar-empty">{t.noEventsToday}</p>
        )}
      </section>

      <section className="calendar-section" aria-labelledby="calendar-month-heading">
        <h2 id="calendar-month-heading">
          {formatMessage(t.monthHeading, {
            month: formatMonth(selectedMonth.year, selectedMonth.month, locale),
          })}
        </h2>
        <nav className="calendar-month-navigation" aria-label={t.monthNavigationLabel}>
          {previousMonth ? (
            <Link href={getCalendarHref(previousMonth)}>{t.previousMonth}</Link>
          ) : (
            <span aria-disabled="true">{t.previousMonth}</span>
          )}
          {nextMonth ? (
            <Link href={getCalendarHref(nextMonth)}>{t.nextMonth}</Link>
          ) : (
            <span aria-disabled="true">{t.nextMonth}</span>
          )}
        </nav>
        {monthlyEvents.length > 0 ? (
          <EventList events={monthlyEvents} locale={locale} />
        ) : (
          <p className="calendar-empty">{t.noEventsThisMonth}</p>
        )}
      </section>

      <Link className="content-back-link" href="/discover">
        ← {t.back}
      </Link>
    </article>
  );
}
