import type { Locale } from "../i18n";

/** クイズで利用できるLocale非依存のカテゴリIDです。 */
export type QuizCategory =
  | "ireland-basics"
  | "pub-guinness"
  | "irish-whiskey"
  | "irish-music"
  | "irish-sports"
  | "literature"
  | "myth-folklore"
  | "history";

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
