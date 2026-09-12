import type { Locale } from "../i18n";
import { quizQuestions } from "./data";
import type { QuizAnswerResult, QuizDate, QuizQuestion } from "./types";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function isValidDate(date: QuizDate): boolean {
  if (
    !Number.isInteger(date.year) ||
    date.year < 1583 ||
    !Number.isInteger(date.month) ||
    !Number.isInteger(date.day)
  ) {
    return false;
  }
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(date.year, date.month - 1, date.day);
  return (
    parsed.getUTCFullYear() === date.year && parsed.getUTCMonth() + 1 === date.month && parsed.getUTCDate() === date.day
  );
}

function dateIndex(date: QuizDate): number {
  const value = new Date(0);
  value.setUTCHours(0, 0, 0, 0);
  value.setUTCFullYear(date.year, date.month - 1, date.day);
  return Math.floor(value.getTime() / MILLISECONDS_PER_DAY);
}

/** `Date`をAsia/Tokyoのクイズ選択用暦日に変換します。
 * @param {Date} now 変換する時刻。省略時は現在時刻。
 * @returns {QuizDate} 東京時間での年月日。
 */
export function getQuizDateInTokyo(now: Date = new Date()): QuizDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return Object.freeze({ year: read("year"), month: read("month"), day: read("day") });
}

/** 暦日から決定的に今日の問題を選び、記念日一致問題を優先します。
 * @param {QuizDate} date Asia/Tokyo基準の暦日。
 * @param {readonly T[]} questions Special Dateを判定できる選択対象。省略時は同梱JSONを使用します。
 * @returns {T} 同じ日付と問題集合に対して常に同じ問題。
 */
export function selectDailyQuiz<T extends Pick<QuizQuestion, "specialDate">>(
  date: QuizDate,
  questions: readonly T[],
): T;
export function selectDailyQuiz(date: QuizDate): QuizQuestion;
export function selectDailyQuiz(
  date: QuizDate,
  questions: readonly Pick<QuizQuestion, "specialDate">[] = quizQuestions,
): Pick<QuizQuestion, "specialDate"> {
  if (!isValidDate(date)) throw new Error("A valid quiz date of 1583 or later is required");
  if (questions.length === 0) throw new Error("At least one quiz question is required");
  const specialQuestions = questions.filter(
    (question) => question.specialDate?.month === date.month && question.specialDate.day === date.day,
  );
  const regularQuestions = questions.filter((question) => question.specialDate === undefined);
  const candidates =
    specialQuestions.length > 0 ? specialQuestions : regularQuestions.length > 0 ? regularQuestions : questions;
  const index = ((dateIndex(date) % candidates.length) + candidates.length) % candidates.length;
  return candidates[index];
}

/** 問題IDとchoice IDを検証し、回答後に公開するLocale別結果を生成します。
 * @param {string} questionId 表示中の問題ID。
 * @param {string} choiceId 利用者が選択したchoice ID。
 * @param {Locale} locale 結果の表示言語。
 * @param {readonly QuizQuestion[]} questions 採点対象。省略時は同梱JSONを使用します。
 * @returns {QuizAnswerResult} 正誤、正解、解説、情報源、任意のGuide導線。
 */
export function gradeQuizAnswer(
  questionId: string,
  choiceId: string,
  locale: Locale,
  questions: readonly QuizQuestion[] = quizQuestions,
): QuizAnswerResult {
  const question = questions.find((item) => item.id === questionId);
  if (!question) throw new Error("Quiz question was not found");
  if (!question.choices.some((choice) => choice.id === choiceId)) throw new Error("Quiz choice was not found");
  const correctChoice = question.choices.find((choice) => choice.id === question.answer)!;

  return Object.freeze({
    status: choiceId === question.answer ? "correct" : "incorrect",
    correctChoiceId: correctChoice.id,
    correctChoiceLabel: correctChoice.label[locale],
    explanation: question.explanation[locale],
    source: Object.freeze({ label: question.source.label[locale], url: question.source.url }),
    ...(question.relatedGuide
      ? {
          relatedGuide: Object.freeze({ slug: question.relatedGuide.slug, label: question.relatedGuide.label[locale] }),
        }
      : {}),
  });
}
