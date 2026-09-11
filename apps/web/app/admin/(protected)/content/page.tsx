import Link from "next/link";
import { readAdminContentList } from "../../../lib/admin-content-service";
import { isContentDatabaseConfigured } from "../../../lib/admin-content-repository";
import { isE2ETestMode } from "../../../lib/e2e-test-mode";
import { requireAdminSession } from "../../../lib/admin-server";
import { getTranslation, type Locale } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

/**
 * Draftを含むEditorial Content一覧を管理者へ表示します。
 * @returns {Promise<JSX.Element>} Content管理一覧。
 */
export default async function AdminContentPage() {
  await requireAdminSession();
  const locale = await getRequestLocale();
  const content = await readAdminContentList();
  const c = getTranslation(locale).admin.content;
  const databaseConfigured = isContentDatabaseConfigured() || isE2ETestMode();

  return (
    <section className="admin-panel admin-wide">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">Editorial content</p>
          <h1>{c.listHeading}</h1>
          <p>{c.listDescription}</p>
        </div>
        <Link className="admin-primary-link" href="/admin/content/new">
          {c.addContent}
        </Link>
      </div>
      {!databaseConfigured ? <p className="admin-error">{getTranslation(locale).admin.databaseUnavailable}</p> : null}

      {content.length === 0 ? (
        <div className="admin-empty">
          <p>{c.noContent}</p>
          <Link href="/admin/content/new">{c.addFirstContent}</Link>
        </div>
      ) : (
        <div className="admin-pub-table-wrap admin-content-table-wrap">
          <table className="admin-pub-table admin-content-table">
            <thead>
              <tr>
                <th>{c.title}</th>
                <th>{c.kind}</th>
                <th>{c.slug}</th>
                <th>{c.category}</th>
                <th>{c.status}</th>
                <th>{c.updatedAt}</th>
                <th>{c.publishedDate}</th>
                <th>{c.operations}</th>
              </tr>
            </thead>
            <tbody>
              {content.map((item) => (
                <tr key={item.id}>
                  <td data-label={c.title}>
                    <strong>{item.titleJa || c.untitled}</strong>
                    {item.titleEn ? (
                      <span className="admin-content-list-en" lang="en">
                        {item.titleEn}
                      </span>
                    ) : null}
                  </td>
                  <td data-label={c.kind}>{item.kind ? c.kinds[item.kind] : c.notSet}</td>
                  <td data-label={c.slug}>
                    <code>{item.slug ?? c.notSet}</code>
                  </td>
                  <td data-label={c.category}>{item.category ? c.categories[item.category] : c.notSet}</td>
                  <td data-label={c.status}>
                    <span
                      className={`admin-publication-badge ${item.status === "published" ? "is-published" : "is-unpublished"}`}
                    >
                      {item.status === "published" ? c.statusPublished : c.statusDraft}
                    </span>
                  </td>
                  <td data-label={c.updatedAt}>
                    <time dateTime={item.updatedAt}>{formatDate(item.updatedAt, locale)}</time>
                  </td>
                  <td data-label={c.publishedDate}>
                    {item.publishedAt ? (
                      <time dateTime={item.publishedAt}>{formatDate(item.publishedAt, locale)}</time>
                    ) : (
                      c.notPublished
                    )}
                  </td>
                  <td data-label={c.operations}>
                    <Link className="admin-row-link" href={`/admin/content/${item.id}`}>
                      {c.edit}
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
