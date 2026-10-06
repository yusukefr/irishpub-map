"use server";

import { getRequestLocale } from "../../../lib/i18n/server";
import { gradePublishedQuizAnswer } from "../../../lib/quiz/repository";
import {
  isQuizQuestionId,
  isQuizChoiceId,
  QUIZ_CHOICE_ID_MAX_LENGTH,
  type QuizAnswerResult,
} from "../../../lib/quiz/types";

/** 回答をサーバー上で採点し、回答後にのみ正解と解説を返します。
 * @param {string} questionId 表示中の問題ID。
 * @param {string} choiceId 利用者が選択したchoice ID。
 * @returns {Promise<QuizAnswerResult>} 現在Localeに対応する採点結果。
 */
export async function submitQuizAnswer(questionId: string, choiceId: string): Promise<QuizAnswerResult> {
  if (typeof questionId !== "string" || typeof choiceId !== "string") {
    throw new Error("Question and choice IDs are required");
  }
  if (!isQuizQuestionId(questionId) || !isQuizChoiceId(choiceId, QUIZ_CHOICE_ID_MAX_LENGTH)) {
    throw new Error("Invalid quiz answer");
  }
  const locale = await getRequestLocale();
  return gradePublishedQuizAnswer(questionId, choiceId, locale);
}
