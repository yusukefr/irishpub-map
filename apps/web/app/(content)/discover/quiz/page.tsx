import type { Metadata } from "next";
import Link from "next/link";
import { getTranslation } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";

/**
 * 選択言語に対応するQuiz placeholderのメタデータを生成します。
 * @returns {Promise<Metadata>} Quizページのtitleとdescription。
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = getTranslation(await getRequestLocale()).discover;

  return {
    title: `${t.quiz} | Irish Pub Map`,
    description: t.quizPlaceholder,
  };
}

/**
 * 後続実装予定のToday's Ireland QuizのRouting placeholderを表示します。
 * @returns {Promise<JSX.Element>} Quiz準備中メッセージとHubへの導線。
 */
export default async function QuizPage() {
  const t = getTranslation(await getRequestLocale()).discover;

  return (
    <section className="content-container content-article" aria-labelledby="quiz-heading">
      <p className="content-kicker">Explore Ireland</p>
      <h1 id="quiz-heading">{t.quiz}</h1>
      <p className="content-lead">{t.quizPlaceholder}</p>
      <Link className="content-back-link" href="/discover">
        ← {t.back}
      </Link>
    </section>
  );
}
