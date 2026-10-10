import Link from "next/link";
import { readAdminQuizList } from "../../../lib/admin-quiz-service";
import { isQuizDatabaseConfigured } from "../../../lib/quiz/repository";
import { isE2ETestMode } from "../../../lib/e2e-test-mode";
import { requireAdminSession } from "../../../lib/admin-server";
import { getTranslation, type Locale } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { AdminPageHeader } from "../../../components/admin-page-header";
/**
 * DraftとPublishedを含むQuiz管理一覧を表示します。
 * @returns {JSX.Element} Quiz管理一覧。
 */
export default async function AdminQuizPage() {
  await requireAdminSession();
  const locale = await getRequestLocale();
  const questions = await readAdminQuizList();
  const t = getTranslation(locale).admin;
  const q = t.quiz;
  const databaseConfigured = isQuizDatabaseConfigured() || isE2ETestMode();
  return (
    <section className="admin-quiz-list">
      <AdminPageHeader
        sectionLabel="Irish Quiz"
        title={q.listHeading}
        description={q.listDescription}
        actions={
          <Link className="admin-primary-link" href="/admin/quiz/new">
            {q.addQuiz}
          </Link>
        }
      />
      {!databaseConfigured ? <p className="admin-error">{t.databaseUnavailable}</p> : null}
      {questions.length === 0 ? (
        <div className="admin-empty">
          <p>{q.noQuiz}</p>
          <Link href="/admin/quiz/new">{q.addFirstQuiz}</Link>
        </div>
      ) : (
        <div className="admin-pub-table-wrap">
          <table className="admin-pub-table">
            <thead>
              <tr>
                <th>{q.question}</th>
                <th>{q.category}</th>
                <th>{q.specialDate}</th>
                <th>{q.choices}</th>
                <th>{t.status}</th>
                <th>{t.updatedAt}</th>
                <th>{t.operations}</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((question) => (
                <tr key={question.id}>
                  <td data-label={q.question}>
                    <strong>{question.questionJa || "—"}</strong>
                    {question.questionEn ? (
                      <span className="admin-content-list-en" lang="en">
                        {question.questionEn}
                      </span>
                    ) : null}
                  </td>
                  <td data-label={q.category}>
                    {question.category ? q.categories[question.category] : t.notRegistered}
                  </td>
                  <td data-label={q.specialDate}>
                    {question.specialDate
                      ? `${question.specialDate.month}/${question.specialDate.day}`
                      : q.noSpecialDate}
                  </td>
                  <td data-label={q.choices}>{question.choiceCount}</td>
                  <td data-label={t.status}>
                    <span
                      className={`admin-publication-badge ${question.isPublished ? "is-published" : "is-unpublished"}`}
                    >
                      {question.isPublished ? q.statusPublished : q.statusDraft}
                    </span>
                  </td>
                  <td data-label={t.updatedAt}>
                    <time dateTime={question.updatedAt}>{formatDate(question.updatedAt, locale)}</time>
                  </td>
                  <td data-label={t.operations}>
                    <Link className="admin-row-link" href={`/admin/quiz/${question.id}`}>
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
