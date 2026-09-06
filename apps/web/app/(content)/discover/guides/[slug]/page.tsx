import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getContentRenderer } from "../../../../lib/content/registry";
import { getPublishedContentBySlug } from "../../../../lib/content/repository";
import { getTranslation } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * Registryに登録されたGuideのMDX metadataからページメタデータを生成します。
 * @param {GuidePageProps} props - Promiseとして渡される動的Route params。
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
 * 公開済みDB Contentを固定Renderer経由で表示します。
 * @param {GuidePageProps} props - Promiseとして渡される動的Route params。
 * @returns {Promise<JSX.Element>} Metadata見出し、Markdown本文、Hubへの導線。
 */
export default async function GuidePage({ params }: GuidePageProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const content = await getPublishedContentBySlug("guide", slug, locale);
  if (!content) notFound();

  const t = getTranslation(locale).discover;
  const GuideContent = getContentRenderer(content.kind);

  return (
    <article className="content-container content-article">
      <p className="content-kicker">{t.guides}</p>
      <h1>{content.title}</h1>
      <p className="content-lead">{content.summary}</p>
      <div className="content-prose">
        <GuideContent markdown={content.bodyMarkdown} />
      </div>
      <Link className="content-back-link" href="/discover">
        ← {t.back}
      </Link>
    </article>
  );
}
