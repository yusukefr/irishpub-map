import type { QuizCategory, QuizCategoryDefinition } from "./types";
import { QUIZ_CATEGORIES } from "./types";

/** Quiz Categoryの表示用定義です。Question Dataとは分離して管理します。 */
export const QUIZ_CATEGORY_DEFINITIONS = {
  "ireland-basics": {
    icon: "☘️",
    label: { ja: "アイルランド基礎", en: "Ireland Basics" },
  },
  "pub-guinness": {
    icon: "🍺",
    label: { ja: "Pub & Guinness", en: "Pub & Guinness" },
  },
  "irish-whiskey": {
    icon: "🥃",
    label: { ja: "アイリッシュウイスキー", en: "Irish Whiskey" },
  },
  "irish-music": {
    icon: "🎻",
    label: { ja: "アイリッシュ音楽", en: "Irish Music" },
  },
  "irish-sports": {
    icon: "🏑",
    label: { ja: "アイルランドのスポーツ", en: "Irish Sports" },
  },
  literature: {
    icon: "📚",
    label: { ja: "文学", en: "Literature" },
  },
  "myth-folklore": {
    icon: "👻",
    label: { ja: "神話と民間伝承", en: "Myth & Folklore" },
  },
  history: {
    icon: "🏰",
    label: { ja: "歴史", en: "History" },
  },
} satisfies Record<QuizCategory, QuizCategoryDefinition>;

const categoryKeys = Object.keys(QUIZ_CATEGORY_DEFINITIONS) as QuizCategory[];
if (
  categoryKeys.length !== QUIZ_CATEGORIES.length ||
  QUIZ_CATEGORIES.some((category) => !categoryKeys.includes(category))
) {
  throw new Error("Quiz category definitions must match the category allow list.");
}
