import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadLegacyGuide } from "../../../../lib/content/legacy-repository";
import { getTranslation } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n/server";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * 固定Allow Listの既存MDX Guide metadataからページメタデータを生成します。
 * @param {GuidePageProps} props - Promiseとして渡される動的Route params。
 * @returns {Promise<Metadata>} Guideのtitleとsummary。
 */
export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const content = await loadLegacyGuide(slug, locale);
  if (!content) notFound();

  return {
    title: `${content.metadata.title} | Irish Pub Map`,
    description: content.metadata.summary,
  };
}

/**
 * 固定Allow Listの既存MDX Guideを表示します。
 * @param {GuidePageProps} props - Promiseとして渡される動的Route params。
 * @returns {Promise<JSX.Element>} Metadata見出し、MDX本文、Hubへの導線。
 */
export default async function GuidePage({ params }: GuidePageProps) {
  const [{ slug }, locale] = await Promise.all([params, getRequestLocale()]);
  const content = await loadLegacyGuide(slug, locale);
  if (!content) notFound();

  const t = getTranslation(locale).discover;
  return (
    <article className="content-container content-article">
      <p className="content-kicker">{t.guides}</p>
      <h1>{content.metadata.title}</h1>
      <p className="content-lead">{content.metadata.summary}</p>
      <div className="content-prose">
        <content.Component />
      </div>
      <Link className="content-back-link" href="/discover">
        ← {t.back}
      </Link>
    </article>
  );
}
