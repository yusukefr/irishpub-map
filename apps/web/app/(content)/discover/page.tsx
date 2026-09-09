import type { Metadata } from "next";
import Link from "next/link";
import { ContentCard } from "../../components/ui/content-card";
import { listLegacyGuides } from "../../lib/content/legacy-repository";
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
 * @returns {Promise<JSX.Element>} 既存MDX Guide一覧を含むHub。
 */
export default async function DiscoverPage() {
  const locale = await getRequestLocale();
  const t = getTranslation(locale).discover;
  const guides = await listLegacyGuides(locale);

  return (
    <section className="content-container discover-page" aria-labelledby="discover-heading">
      <header className="content-hero">
        <h1 id="discover-heading">{t.heading}</h1>
        <p className="content-lead">{t.lead}</p>
      </header>

      <div className="discover-sections">
        <ContentCard titleId="discover-stories-heading" title={t.stories} description={t.comingSoon} />

        <ContentCard titleId="discover-guides-heading" title={t.guides}>
          <ul className="discover-links">
            {guides.map((guide) => (
              <li key={guide.slug}>
                <Link href={`/discover/guides/${guide.slug}`}>{guide.title} →</Link>
              </li>
            ))}
          </ul>
        </ContentCard>

        <ContentCard
          titleId="discover-quiz-heading"
          title={t.quiz}
          action={
            <Link className="content-action-link" href="/discover/quiz">
              {t.viewQuiz} →
            </Link>
          }
        />

        <ContentCard
          titleId="discover-calendar-heading"
          title={t.calendarTitle}
          description={t.calendarSummary}
          action={
            <Link className="content-action-link discover-section-action" href="/discover/calendar">
              {t.viewCalendar} →
            </Link>
          }
        />
      </div>
    </section>
  );
}
