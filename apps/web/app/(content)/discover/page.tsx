import type { Metadata } from "next";
import Link from "next/link";
import { listContent } from "../../lib/content/repository";
import { getTranslation } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

/**
 * 選択言語に対応するExplore Ireland Hubのメタデータを生成します。
 * @returns {Promise<Metadata>} Hubのtitleとdescription。
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = getTranslation(await getRequestLocale()).discover;

  return {
    title: `${t.heading} | Irish Pub Map`,
    description: t.lead,
  };
}

/**
 * Stories、Guide、Quizへの入口となるExplore Ireland Hubを表示します。
 * @returns {Promise<JSX.Element>} Registry由来のGuide一覧を含むHub。
 */
export default async function DiscoverPage() {
  const locale = await getRequestLocale();
  const t = getTranslation(locale).discover;
  const guides = await listContent("guide", locale);

  return (
    <section className="content-container discover-page" aria-labelledby="discover-heading">
      <header className="content-hero">
        <h1 id="discover-heading">{t.heading}</h1>
        <p className="content-lead">{t.lead}</p>
      </header>

      <div className="discover-sections">
        <section className="discover-section" aria-labelledby="discover-stories-heading">
          <h2 id="discover-stories-heading">{t.stories}</h2>
          <p>{t.comingSoon}</p>
        </section>

        <section className="discover-section" aria-labelledby="discover-guides-heading">
          <h2 id="discover-guides-heading">{t.guides}</h2>
          <ul className="discover-links">
            {guides.map((guide) => (
              <li key={guide.slug}>
                <Link href={`/discover/guides/${guide.slug}`}>{guide.title} →</Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="discover-section" aria-labelledby="discover-quiz-heading">
          <h2 id="discover-quiz-heading">{t.quiz}</h2>
          <Link className="content-action-link" href="/discover/quiz">
            {t.viewQuiz} →
          </Link>
        </section>

        <section className="discover-section" aria-labelledby="discover-calendar-heading">
          <h2 id="discover-calendar-heading">{t.calendarTitle}</h2>
          <p>{t.calendarSummary}</p>
          <Link className="content-action-link discover-section-action" href="/discover/calendar">
            {t.viewCalendar} →
          </Link>
        </section>
      </div>
    </section>
  );
}
