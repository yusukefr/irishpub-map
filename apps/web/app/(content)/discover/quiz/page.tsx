import type { Metadata } from "next";
import Link from "next/link";
import { getTranslation } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { quizData } from "../../../lib/quiz/data";
import { getQuizDateInTokyo, selectDailyQuiz } from "../../../lib/quiz/queries";
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
  const question = selectDailyQuiz(getQuizDateInTokyo());
  const category = quizData.categories[question.category];

  return (
    <article className="content-container quiz-page" aria-labelledby="quiz-heading">
      <header className="content-hero">
        <p className="content-kicker">{t.heading}</p>
        <h1 id="quiz-heading">{t.quiz}</h1>
        <p className="content-lead">{t.quizContent.lead}</p>
      </header>

      <QuizCard
        question={{
          id: question.id,
          category: {
            icon: category.icon,
            label: category.label[locale],
          },
          question: question.question[locale],
          choices: question.choices.map((choice) => ({ id: choice.id, label: choice.label[locale] })),
        }}
        labels={t.quizContent}
      />

      <Link className="content-back-link" href="/discover">
        ← {t.back}
      </Link>
    </article>
  );
}
