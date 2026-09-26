import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ShareButton } from "../../../../components/share-button";
import { getContentRenderer } from "../../../../lib/content/renderer-registry";
import { getPublishedContentBySlug } from "../../../../lib/content/repository";
import { getTranslation } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";
import { getStoryUrl } from "../../../../lib/public-url";
import { DiscoverBreadcrumbs, RelatedContent } from "../../components";

type StoryPageProps = { params: Promise<{ slug: string }> };
const StoryContentRenderer = getContentRenderer("story");

/**
 * 公開済みStoryのmetadataを生成します。
 * @param {StoryPageProps} props - Story slug。
 * @returns {Promise<Metadata>} 公開Storyのtitle、summary、canonical URL。
 */
export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const content = await getPublishedContentBySlug("story", slug, locale);
  if (!content) notFound();
  return {
    title: `${content.title} | Irish Pub Map`,
    description: content.summary,
    alternates: { canonical: getStoryUrl(content.slug) },
  };
}

/**
 * 公開済みStoryをGuideと同じ安全なMarkdown本文レイアウトで表示します。
 * @param {StoryPageProps} props - Story slug。
 * @returns {Promise<JSX.Element>} 公開Story本文。
 */
export default async function StoryPage({ params }: StoryPageProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const content = await getPublishedContentBySlug("story", slug, locale);
  if (!content) notFound();

  const t = getTranslation(locale).discover;
  const publishedAt = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(content.publishedAt),
  );

  return (
    <article className="content-container content-article guide-page">
      <DiscoverBreadcrumbs
        label={t.breadcrumbsLabel}
        items={[
          { label: t.heading, href: "/discover" },
          { label: t.stories, href: "/discover#discover-stories-heading" },
          { label: content.title },
        ]}
      />
      <header className="guide-header">
        <p className="content-kicker">{t.storyLabel}</p>
        <h1>{content.title}</h1>
        <p className="content-lead">{content.summary}</p>
        {content.heroImage ? (
          <figure className="guide-hero">
            <Image
              src={content.heroImage.url}
              alt={content.heroImage.alt}
              width={content.heroImage.width}
              height={content.heroImage.height}
              sizes="(max-width: 760px) calc(100vw - 32px), 720px"
              preload
            />
            {content.heroImage.caption ? <figcaption>{content.heroImage.caption}</figcaption> : null}
          </figure>
        ) : null}
        <p className="guide-metadata">
          <time dateTime={content.publishedAt}>{publishedAt}</time>
        </p>
        <ShareButton title={content.title} url={getStoryUrl(content.slug)} locale={locale} />
      </header>
      <div className="content-prose">
        <StoryContentRenderer markdown={content.bodyMarkdown} />
      </div>
      <RelatedContent
        heading={t.relatedHeading}
        items={[
          {
            id: "guides",
            title: t.guides,
            description: t.related.guidesDescription,
            href: "/discover#discover-guides-heading",
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
