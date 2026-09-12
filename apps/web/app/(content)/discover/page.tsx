import type { Metadata } from "next";
import Link from "next/link";
import { ContentCard } from "../../components/ui/content-card";
import { listPublishedContent } from "../../lib/content/repository";
import { getTranslation } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

function formatPublishedAt(publishedAt: string, locale: "ja" | "en"): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(publishedAt));
}

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
 * Stories、Guide、Quiz、Calendarと地図への入口となるExplore Ireland Hubを表示します。
 * @returns {Promise<JSX.Element>} 公開済みEditorial Guide一覧を含むHub。
 */
export default async function DiscoverPage() {
  const locale = await getRequestLocale();
  const t = getTranslation(locale).discover;
  const guides = await listPublishedContent("guide", locale);

  return (
    <section className="content-container discover-page" aria-labelledby="discover-heading">
      <header className="content-hero discover-hero">
        <p className="content-kicker">{t.kicker}</p>
        <h1 id="discover-heading">{t.heading}</h1>
        <p className="content-lead">{t.lead}</p>
        <Link className="content-primary-action" href="/">
          {t.mapAction}
        </Link>
      </header>

      <div className="discover-feature-grid">
        <ContentCard
          titleId="discover-calendar-heading"
          title={t.calendarTitle}
          description={t.calendarSummary}
          eyebrow={t.calendar.kicker}
          variant="feature"
          action={<Link href="/discover/calendar">{t.viewCalendar}</Link>}
        />
        <ContentCard
          titleId="discover-quiz-heading"
          title={t.quiz}
          description={t.quizContent.lead}
          action={<Link href="/discover/quiz">{t.viewQuiz}</Link>}
        />
      </div>

      <section className="discover-guide-section" aria-labelledby="discover-guides-heading">
        <div className="discover-section-heading">
          <p className="content-kicker">{t.guideLabel}</p>
          <h2 id="discover-guides-heading">{t.guides}</h2>
          <p>{t.guidesLead}</p>
        </div>
        <div className="discover-guide-grid">
          {guides.map((guide) => (
            <ContentCard
              key={guide.slug}
              titleId={"discover-guide-" + guide.slug + "-heading"}
              title={guide.title}
              description={guide.summary}
              eyebrow={t.guideLabel}
              headingLevel={3}
              variant="compact"
              metadata={<time dateTime={guide.publishedAt}>{formatPublishedAt(guide.publishedAt, locale)}</time>}
              action={
                <Link href={"/discover/guides/" + guide.slug} aria-label={t.readGuide + ": " + guide.title}>
                  {t.readGuide}
                </Link>
              }
            />
          ))}
        </div>
      </section>

      <div className="discover-stories">
        <ContentCard
          titleId="discover-stories-heading"
          title={t.stories}
          description={t.storiesSummary}
          metadata={<span>{t.comingSoon}</span>}
          variant="text-only"
        />
      </div>
    </section>
  );
}
