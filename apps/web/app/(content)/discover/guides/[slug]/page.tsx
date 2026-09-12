import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContentRenderer } from "../../../../lib/content/registry";
import { getPublishedContentBySlug } from "../../../../lib/content/repository";
import { getTranslation } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";
import { DiscoverBreadcrumbs, RelatedContent } from "../../components";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

const GuideContentRenderer = getContentRenderer("guide");

/**
 * 公開済みEditorial Guideのmetadataからページメタデータを生成します。
 * @param {GuidePageProps} props Promiseとして渡される動的Route params。
 * @returns {Promise<Metadata>} Guideのtitleとsummary。
 */
export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const content = await getPublishedContentBySlug("guide", slug, locale);
  if (!content) notFound();

  return {
    title: `${content.title} | Irish Pub Map`,
    description: content.summary,
  };
}

/**
 * 公開済みEditorial Guideを、パンくずと関連導線を含む長文レイアウトで表示します。
 * @param {GuidePageProps} props Promiseとして渡される動的Route params。
 * @returns {Promise<JSX.Element>} Metadata見出し、安全なMarkdown本文、関連コンテンツ。
 */
export default async function GuidePage({ params }: GuidePageProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const content = await getPublishedContentBySlug("guide", slug, locale);
  if (!content) notFound();

  const t = getTranslation(locale).discover;
  const publishedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(content.publishedAt));

  return (
    <article className="content-container content-article guide-page">
      <DiscoverBreadcrumbs
        label={t.breadcrumbsLabel}
        items={[
          { label: t.heading, href: "/discover" },
          { label: t.guides, href: "/discover#discover-guides-heading" },
          { label: content.title },
        ]}
      />

      <header className="guide-header">
        <p className="content-kicker">{t.guideLabel}</p>
        <h1>{content.title}</h1>
        <p className="content-lead">{content.summary}</p>
        <p className="guide-metadata">
          <time dateTime={content.publishedAt}>{publishedAt}</time>
        </p>
      </header>

      <div className="content-prose">
        <GuideContentRenderer markdown={content.bodyMarkdown} />
      </div>

      <RelatedContent
        heading={t.relatedHeading}
        items={[
          {
            id: "calendar",
            title: t.calendarTitle,
            description: t.related.calendarDescription,
            href: "/discover/calendar",
            actionLabel: t.related.view,
          },
          {
            id: "quiz",
            title: t.quiz,
            description: t.related.quizDescription,
            href: "/discover/quiz",
            actionLabel: t.related.view,
          },
          {
            id: "map",
            title: t.related.mapTitle,
            description: t.related.mapDescription,
            href: "/",
            actionLabel: t.related.view,
          },
        ]}
      />
    </article>
  );
}
