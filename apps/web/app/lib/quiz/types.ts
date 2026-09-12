import type { Locale } from "../i18n";

/** Quizで利用できるLocale非依存カテゴリIDのAllow Listです。 */
export const QUIZ_CATEGORIES = [
  "ireland-basics",
  "pub-guinness",
  "irish-whiskey",
  "irish-music",
  "irish-sports",
  "literature",
  "myth-folklore",
  "history",
] as const;

/** クイズで利用できるLocale非依存のカテゴリIDです。 */
export type QuizCategory = (typeof QUIZ_CATEGORIES)[number];

/** 日英の表示文言です。 */
export type QuizLocalizedText = Readonly<Record<Locale, string>>;

/** カテゴリの表示情報です。 */
export type QuizCategoryDefinition = Readonly<{ icon: string; label: QuizLocalizedText }>;

/** 問題内で選択できる回答です。 */
export type QuizChoice = Readonly<{ id: string; label: QuizLocalizedText }>;

/** 毎年優先表示する月日です。 */
export type QuizSpecialDate = Readonly<{ month: number; day: number }>;

/** 正解・解説の根拠となる公式情報源です。 */
export type QuizSource = Readonly<{ label: QuizLocalizedText; url: string }>;

/** 回答後に表示できる関連Guideです。 */
export type QuizRelatedGuide = Readonly<{ slug: string; label: QuizLocalizedText }>;

/** 検証済みのクイズ問題です。 */
export type QuizQuestion = Readonly<{
  id: string;
  category: QuizCategory;
  question: QuizLocalizedText;
  choices: readonly QuizChoice[];
  answer: string;
  explanation: QuizLocalizedText;
  source: QuizSource;
  specialDate?: QuizSpecialDate;
  relatedGuide?: QuizRelatedGuide;
}>;

/** 検証済みのクイズデータ全体です。 */
export type QuizData = Readonly<{
  schemaVersion: 1;
  country: "IE";
  categories: Readonly<Record<QuizCategory, QuizCategoryDefinition>>;
  questions: readonly QuizQuestion[];
}>;

/** タイムゾーンを持たないクイズ選択用の暦日です。 */
export type QuizDate = Readonly<{ year: number; month: number; day: number }>;

/** Server Actionが回答後だけ返す、Locale別の採点結果です。 */
export type QuizAnswerResult = Readonly<{
  status: "correct" | "incorrect";
  correctChoiceId: string;
  correctChoiceLabel: string;
  explanation: string;
  source: Readonly<{ label: string; url: string }>;
  relatedGuide?: Readonly<{ slug: string; label: string }>;
}>;

/** 回答前のClientへ渡せる、採点情報を含まないChoiceです。 */
export type PublicQuizChoice = Readonly<{ id: string; label: string }>;

/** 回答前のClientへ渡せる公開Questionです。 */
export type PublicQuizQuestion = Readonly<{
  id: string;
  category: QuizCategory;
  question: string;
  choices: readonly PublicQuizChoice[];
  specialDate?: QuizSpecialDate;
}>;

/** 入力途中のDraftを保持できる管理用翻訳です。 */
export type AdminQuizTranslation = Readonly<{
  question: string;
  explanation: string;
  sourceLabel: string;
}>;

/** 入力途中のDraftを保持できる管理用Choiceです。 */
export type AdminQuizChoice = Readonly<{
  id: string;
  sortOrder: number;
  translations: Readonly<Record<Locale, string>>;
}>;

/** 管理画面で編集するQuestion全体のスナップショットです。 */
export type AdminQuizQuestion = Readonly<{
  id: string;
  category: QuizCategory | null;
  specialDate: QuizSpecialDate | null;
  correctChoiceId: string | null;
  sourceUrl: string | null;
  relatedContentId: string | null;
  isPublished: boolean;
  translations: Readonly<Record<Locale, AdminQuizTranslation>>;
  choices: readonly AdminQuizChoice[];
  createdAt: string;
  updatedAt: string;
}>;

/** 管理一覧用の軽量なQuestionです。 */
export type AdminQuizListItem = Omit<AdminQuizQuestion, "translations" | "choices"> & {
  questionJa: string;
  questionEn: string;
  choiceCount: number;
};

/** 作成・更新で保存する、公開状態と監査日時を除いたQuestion全体です。 */
export type AdminQuizWriteInput = Pick<
  AdminQuizQuestion,
  "category" | "specialDate" | "correctChoiceId" | "sourceUrl" | "relatedContentId" | "translations" | "choices"
>;

/**
 * 指定値がQuizカテゴリのAllow Listに含まれるか判定します。
 * @param {string} value 判定対象。
 * @returns {value is QuizCategory} 許可済みカテゴリの場合はtrue。
 */
export function isQuizCategory(value: string): value is QuizCategory {
  return QUIZ_CATEGORIES.includes(value as QuizCategory);
}
