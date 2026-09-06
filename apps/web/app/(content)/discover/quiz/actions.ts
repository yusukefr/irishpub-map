"use server";

import { getRequestLocale } from "../../../lib/i18n/server";
import { gradeQuizAnswer } from "../../../lib/quiz/queries";
import type { QuizAnswerResult } from "../../../lib/quiz/types";

/** 回答をサーバー上で採点し、回答後にのみ正解と解説を返します。
 * @param {string} questionId 表示中の問題ID。
 * @param {string} choiceId 利用者が選択したchoice ID。
 * @returns {Promise<QuizAnswerResult>} 現在Localeに対応する採点結果。
 */
export async function submitQuizAnswer(questionId: string, choiceId: string): Promise<QuizAnswerResult> {
  if (typeof questionId !== "string" || typeof choiceId !== "string") {
    throw new Error("Question and choice IDs are required");
  }
  return gradeQuizAnswer(questionId, choiceId, await getRequestLocale());
}
