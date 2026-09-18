import Link from "next/link";
import { readAdminCalendarList } from "../../../lib/admin-calendar-service";
import { isCalendarDatabaseConfigured } from "../../../lib/calendar/repository";
import { formatCalendarDateRuleSummary } from "../../../lib/calendar/date-rule-summary";
import { isE2ETestMode } from "../../../lib/e2e-test-mode";
import { requireAdminSession } from "../../../lib/admin-server";
import { getTranslation, type Locale } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

/**
 * DraftとPublishedを含むCalendar管理一覧を表示します。
 * @returns {Promise<JSX.Element>} Calendar管理一覧UI。
 */
export default async function AdminCalendarPage() {
  await requireAdminSession();
  const [locale, events] = await Promise.all([getRequestLocale(), readAdminCalendarList()]);
  const t = getTranslation(locale).admin;
  const c = t.calendar;
  const databaseConfigured = isCalendarDatabaseConfigured() || isE2ETestMode();

  return (
    <section className="admin-panel admin-wide">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Irish Calendar</p>
          <h1>{c.listHeading}</h1>
          <p>{c.listDescription}</p>
        </div>
        <Link className="admin-primary-link" href="/admin/calendar/new">
          {c.addCalendar}
        </Link>
      </div>
      {!databaseConfigured ? <p className="admin-error">{c.databaseUnavailable}</p> : null}
      {events.length === 0 ? (
        <div className="admin-empty">
          <p>{c.noCalendar}</p>
          <Link href="/admin/calendar/new">{c.addFirstCalendar}</Link>
        </div>
      ) : (
        <div className="admin-pub-table-wrap admin-content-table-wrap">
          <table className="admin-pub-table admin-content-table">
            <thead>
              <tr>
                <th>{c.id}</th>
                <th>{c.name}</th>
                <th>{c.category}</th>
                <th>{c.dateRule}</th>
                <th>{c.publicHoliday}</th>
                <th>{c.featured}</th>
                <th>{t.status}</th>
                <th>{t.updatedAt}</th>
                <th>{t.operations}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td data-label={c.id}>
                    <code>{event.id}</code>
                  </td>
                  <td data-label={c.name}>
                    <strong>{event.nameJa || c.notSet}</strong>
                    {event.nameEn ? (
                      <span className="admin-content-list-en" lang="en">
                        {event.nameEn}
                      </span>
                    ) : null}
                  </td>
                  <td data-label={c.category}>{event.category ? c.categories[event.category] : c.notSet}</td>
                  <td data-label={c.dateRule}>{formatCalendarDateRuleSummary(event.dateRule, locale)}</td>
                  <td data-label={c.publicHoliday}>{event.isPublicHoliday ? "✓" : "—"}</td>
                  <td data-label={c.featured}>{event.featured ? "✓" : "—"}</td>
                  <td data-label={t.status}>
                    <span
                      className={`admin-publication-badge ${event.isPublished ? "is-published" : "is-unpublished"}`}
                    >
                      {event.isPublished ? c.statusPublished : c.statusDraft}
                    </span>
                  </td>
                  <td data-label={t.updatedAt}>
                    <time dateTime={event.updatedAt}>{formatDate(event.updatedAt, locale)}</time>
                  </td>
                  <td data-label={t.operations}>
                    <Link className="admin-row-link" href={`/admin/calendar/${event.id}`}>
                      {t.edit}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
