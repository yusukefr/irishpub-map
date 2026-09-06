import rawQuizData from "../../../data/ireland/quiz.json";
import { contentRegistry } from "../content/registry";
import type {
  QuizCategory,
  QuizCategoryDefinition,
  QuizChoice,
  QuizData,
  QuizLocalizedText,
  QuizQuestion,
  QuizRelatedGuide,
  QuizSource,
  QuizSpecialDate,
} from "./types";

const CATEGORY_IDS = [
  "ireland-basics",
  "pub-guinness",
  "irish-whiskey",
  "irish-music",
  "irish-sports",
  "literature",
  "myth-folklore",
  "history",
] as const satisfies readonly QuizCategory[];
const GUIDE_SLUGS = new Set(Object.keys(contentRegistry.guide));

function fail(path: string, message: string): never {
  throw new Error(`Invalid quiz data at ${path}: ${message}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "must be an object");
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) fail(path, "must be a non-empty string");
  return value;
}

function localizedText(value: unknown, path: string): QuizLocalizedText {
  const input = record(value, path);
  return Object.freeze({ ja: string(input.ja, `${path}.ja`), en: string(input.en, `${path}.en`) });
}

function specialDate(value: unknown, path: string): QuizSpecialDate {
  const input = record(value, path);
  if (!Number.isInteger(input.month) || (input.month as number) < 1 || (input.month as number) > 12) {
    fail(`${path}.month`, "must be an integer between 1 and 12");
  }
  if (!Number.isInteger(input.day)) fail(`${path}.day`, "must be an integer");
  const month = input.month as number;
  const day = input.day as number;
  const maximum = new Date(Date.UTC(2000, month, 0)).getUTCDate();
  if (day < 1 || day > maximum) fail(`${path}.day`, `must be valid for month ${month}`);
  return Object.freeze({ month, day });
}

function source(value: unknown, path: string): QuizSource {
  const input = record(value, path);
  const url = string(input.url, `${path}.url`);
  try {
    if (new URL(url).protocol !== "https:") fail(`${path}.url`, "must use HTTPS");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid quiz data")) throw error;
    fail(`${path}.url`, "must be a valid HTTPS URL");
  }
  return Object.freeze({ label: localizedText(input.label, `${path}.label`), url });
}

function relatedGuide(value: unknown, path: string): QuizRelatedGuide {
  const input = record(value, path);
  const slug = string(input.slug, `${path}.slug`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) fail(`${path}.slug`, "must be a kebab-case slug");
  if (!GUIDE_SLUGS.has(slug)) fail(`${path}.slug`, `must reference a registered guide, received "${slug}"`);
  return Object.freeze({ slug, label: localizedText(input.label, `${path}.label`) });
}

function choice(value: unknown, path: string): QuizChoice {
  const input = record(value, path);
  return Object.freeze({ id: string(input.id, `${path}.id`), label: localizedText(input.label, `${path}.label`) });
}

function question(value: unknown, index: number): QuizQuestion {
  const basePath = `questions[${index}]`;
  const input = record(value, basePath);
  const id = string(input.id, `${basePath}.id`);
  const category = string(input.category, `${basePath}(${id}).category`);
  if (!CATEGORY_IDS.includes(category as QuizCategory)) {
    fail(`${basePath}(${id}).category`, `unsupported category "${category}"`);
  }
  if (!Array.isArray(input.choices) || input.choices.length !== 4) {
    fail(`${basePath}(${id}).choices`, "must contain exactly four choices");
  }
  const choices = Object.freeze(
    input.choices.map((item, choiceIndex) => choice(item, `${basePath}(${id}).choices[${choiceIndex}]`)),
  );
  const choiceIds = new Set<string>();
  choices.forEach((item, choiceIndex) => {
    if (choiceIds.has(item.id))
      fail(`${basePath}(${id}).choices[${choiceIndex}].id`, "must be unique within the question");
    choiceIds.add(item.id);
  });
  const answer = string(input.answer, `${basePath}(${id}).answer`);
  if (!choiceIds.has(answer)) fail(`${basePath}(${id}).answer`, `must reference an existing choice ID`);

  return Object.freeze({
    id,
    category: category as QuizCategory,
    question: localizedText(input.question, `${basePath}(${id}).question`),
    choices,
    answer,
    explanation: localizedText(input.explanation, `${basePath}(${id}).explanation`),
    source: source(input.source, `${basePath}(${id}).source`),
    ...(input.specialDate === undefined
      ? {}
      : { specialDate: specialDate(input.specialDate, `${basePath}(${id}).specialDate`) }),
    ...(input.relatedGuide === undefined
      ? {}
      : { relatedGuide: relatedGuide(input.relatedGuide, `${basePath}(${id}).relatedGuide`) }),
  });
}

/** 未知のJSONを検証し、不変のクイズデータへ変換します。
 * @param {unknown} value 検証するJSON値。
 * @returns {QuizData} 検証済みのカテゴリと問題。
 */
export function parseQuizData(value: unknown): QuizData {
  const input = record(value, "root");
  if (input.schemaVersion !== 1) fail("schemaVersion", "must be 1");
  if (input.country !== "IE") fail("country", 'must be "IE"');

  const categoryInput = record(input.categories, "categories");
  const categories = Object.fromEntries(
    CATEGORY_IDS.map((id) => {
      const item = record(categoryInput[id], `categories.${id}`);
      return [
        id,
        Object.freeze({
          icon: string(item.icon, `categories.${id}.icon`),
          label: localizedText(item.label, `categories.${id}.label`),
        }),
      ];
    }),
  ) as Record<QuizCategory, QuizCategoryDefinition>;

  if (!Array.isArray(input.questions) || input.questions.length === 0) fail("questions", "must be a non-empty array");
  const questions = Object.freeze(input.questions.map(question));
  const questionIds = new Set<string>();
  questions.forEach((item, index) => {
    if (questionIds.has(item.id)) fail(`questions[${index}](${item.id}).id`, "must be unique");
    questionIds.add(item.id);
  });

  return Object.freeze({
    schemaVersion: 1,
    country: "IE",
    categories: Object.freeze(categories),
    questions,
  });
}

/** リポジトリ同梱JSONを起動時に検証したクイズデータです。 */
export const quizData = parseQuizData(rawQuizData);

/** JSON記載順を維持した検証済み問題一覧です。 */
export const quizQuestions = quizData.questions;
