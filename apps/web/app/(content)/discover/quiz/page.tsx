import type { Metadata } from "next";
import { getTranslation } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { isDataSourceConfigured } from "../../../lib/e2e-test-mode";
import { QUIZ_CATEGORY_DEFINITIONS } from "../../../lib/quiz/categories";
import { getDailyPublishedQuiz } from "../../../lib/quiz/repository";
import { DiscoverBreadcrumbs, RelatedContent } from "../components";
import { QuizCard } from "./quiz-card";

/**
 * 選択言語に対応するToday's Ireland Quizのメタデータを生成します。
 * @returns {Promise<Metadata>} Quizページのtitleとdescription。
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = getTranslation(await getRequestLocale()).discover;

  return {
    title: t.quiz + " | Irish Pub Map",
    description: t.quizContent.lead,
  };
}

/**
 * Asia/Tokyoの日付から決定した今日の1問を、正解を含まない公開情報として表示します。
 * @returns {Promise<JSX.Element>} Locale別の問題と回答UI。
 */
export default async function QuizPage() {
  const locale = await getRequestLocale();
  const t = getTranslation(locale).discover;
  let question = null;
  let quizUnavailable = !isDataSourceConfigured();
  if (!quizUnavailable) {
    try {
      question = await getDailyPublishedQuiz(locale);
    } catch {
      console.error("Public Quiz could not be loaded.");
      quizUnavailable = true;
    }
  }

  return (
    <article className="content-container quiz-page" aria-labelledby="quiz-heading">
      <DiscoverBreadcrumbs
        label={t.breadcrumbsLabel}
        items={[{ label: t.heading, href: "/discover" }, { label: t.quiz }]}
      />

      <header className="content-hero">
        <p className="content-kicker">{t.kicker}</p>
        <h1 id="quiz-heading">{t.quiz}</h1>
        <p className="content-lead">{t.quizContent.lead}</p>
      </header>

      <div className="quiz-column">
        {question ? (
          <QuizCard
            question={{
              id: question.id,
              category: {
                icon: QUIZ_CATEGORY_DEFINITIONS[question.category].icon,
                label: QUIZ_CATEGORY_DEFINITIONS[question.category].label[locale],
              },
              question: question.question,
              choices: question.choices,
            }}
            labels={t.quizContent}
          />
        ) : (
          <section className="quiz-card quiz-state" aria-labelledby="quiz-state-heading">
            <h2 id="quiz-state-heading">
              {quizUnavailable ? t.quizContent.unavailableHeading : t.quizContent.emptyHeading}
            </h2>
            <p>{quizUnavailable ? t.quizContent.unavailableDescription : t.quizContent.emptyDescription}</p>
          </section>
        )}
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
            id: "guides",
            title: t.related.guidesTitle,
            description: t.related.guidesDescription,
            href: "/discover#discover-guides-heading",
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
