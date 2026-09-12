"use server";

import { getPublishedContentBySlug } from "../../../lib/content/repository";
import { getRequestLocale } from "../../../lib/i18n/server";
import { gradeQuizAnswer } from "../../../lib/quiz/queries";
import type { QuizAnswerResult } from "../../../lib/quiz/types";

/** 回答をサーバー上で採点し、回答後にのみ正解と解説を返します。
 * 関連Guideは公開状態を確認できた場合だけ含め、確認失敗時も採点結果は返します。
 * @param {string} questionId 表示中の問題ID。
 * @param {string} choiceId 利用者が選択したchoice ID。
 * @returns {Promise<QuizAnswerResult>} 現在Localeに対応する採点結果。
 */
export async function submitQuizAnswer(questionId: string, choiceId: string): Promise<QuizAnswerResult> {
  if (typeof questionId !== "string" || typeof choiceId !== "string") {
    throw new Error("Question and choice IDs are required");
  }
  const locale = await getRequestLocale();
  const result = gradeQuizAnswer(questionId, choiceId, locale);
  if (!result.relatedGuide) return result;

  try {
    const guide = await getPublishedContentBySlug("guide", result.relatedGuide.slug, locale);
    if (guide) return result;
  } catch {
    // 補助導線の取得障害では、採点結果まで利用不能にしません。
  }

  return { ...result, relatedGuide: undefined };
}
