import { neon, type NeonQueryFunctionInTransaction } from "@neondatabase/serverless";
import { DEFAULT_LOCALE, isSupportedLocale, type Locale } from "@irishpub-map/shared/locale";
import { getPublishedContentById } from "../content/repository";
import { rejectE2ETestMutation } from "../e2e-test-mode";
import { getQuizDateInTokyo, selectDailyQuiz } from "./queries";
import {
  QUIZ_CATEGORIES,
  isQuizCategory,
  type AdminQuizChoice,
  type AdminQuizListItem,
  type AdminQuizQuestion,
  type AdminQuizWriteInput,
  type PublicQuizQuestion,
  type QuizAnswerResult,
  type QuizCategory,
  type QuizSpecialDate,
} from "./types";

type DbRow = Record<string, unknown>;
type PublicQuestionBuilder = Omit<PublicQuizQuestion, "choices"> & {
  choices: Array<{ id: string; label: string; sortOrder: number }>;
};

/** 管理Question全体更新の業務結果です。 */
export type AdminQuizUpdateResult = "updated" | "not_found" | "publication_blocked";

/** 管理Question公開状態変更の業務結果です。 */
export type AdminQuizPublicationResult = Readonly<{
  id: string;
  isPublished: boolean;
  unchanged: boolean;
}>;

let sqlClient: ReturnType<typeof neon> | null = null;

/**
 * 公開済みQuestionだけを回答前用DTOで取得します。
 * @param {Locale} locale 優先する表示Locale。
 * @returns {Promise<readonly PublicQuizQuestion[]>} DB未設定時は空配列。
 */
export async function listPublishedQuizQuestions(
  locale: Locale = DEFAULT_LOCALE,
): Promise<readonly PublicQuizQuestion[]> {
  requireLocale(locale);
  if (!process.env.DATABASE_URL) return [];
  const rows = (await getRequiredSql()`
    WITH locale_preference AS (
      SELECT ${locale}::text AS locale, 0 AS priority
      UNION ALL SELECT ${DEFAULT_LOCALE}, 1
    )
    SELECT question.id, question.category, question.special_month, question.special_day,
      translation.question, choice.id AS choice_id, choice.sort_order,
      choice_translation.label AS choice_label
    FROM quiz_questions AS question
    LEFT JOIN LATERAL (
      SELECT value.question
      FROM quiz_question_translations AS value
      JOIN locale_preference AS preference ON preference.locale = value.locale
      WHERE value.question_id = question.id
      ORDER BY preference.priority
      LIMIT 1
    ) AS translation ON TRUE
    LEFT JOIN quiz_choices AS choice ON choice.question_id = question.id
    LEFT JOIN LATERAL (
      SELECT value.label
      FROM quiz_choice_translations AS value
      JOIN locale_preference AS preference ON preference.locale = value.locale
      WHERE value.question_id = choice.question_id AND value.choice_id = choice.id
      ORDER BY preference.priority
      LIMIT 1
    ) AS choice_translation ON TRUE
    WHERE question.is_published = TRUE
    ORDER BY question.id, choice.sort_order, choice.id
  `) as DbRow[];
  return parsePublishedQuizRows(rows);
}

/**
 * Asia/Tokyoの暦日と公開問題集合から日次Questionを決定します。
 * @param {Locale} locale 優先する表示Locale。
 * @param {Date} now 判定基準時刻。
 * @returns {Promise<PublicQuizQuestion | null>} 公開Questionがない場合はnull。
 */
export async function getDailyPublishedQuiz(
  locale: Locale = DEFAULT_LOCALE,
  now: Date = new Date(),
): Promise<PublicQuizQuestion | null> {
  const questions = await listPublishedQuizQuestions(locale);
  if (questions.length === 0) return null;
  return selectDailyQuiz(getQuizDateInTokyo(now), questions);
}

/**
 * 公開Questionの選択肢をDB上で検証し、回答後情報だけを返します。
 * @param {string} questionId 表示したQuestion ID。
 * @param {string} choiceId 利用者が選択したChoice ID。
 * @param {Locale} locale 優先する表示Locale。
 * @returns {Promise<QuizAnswerResult>} 正誤・正解・解説・Source・任意の公開Guide。
 */
export async function gradePublishedQuizAnswer(
  questionId: string,
  choiceId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<QuizAnswerResult> {
  requireLocale(locale);
  requiredNonEmptyString(questionId);
  requiredNonEmptyString(choiceId);
  const rows = (await getRequiredSql()`
    WITH locale_preference AS (
      SELECT ${locale}::text AS locale, 0 AS priority
      UNION ALL SELECT ${DEFAULT_LOCALE}, 1
    )
    SELECT question.id, selected.id AS selected_choice_id,
      question.correct_choice_id, correct_choice.id AS resolved_correct_choice_id,
      translation.explanation, translation.source_label, question.source_url,
      correct_translation.label AS correct_choice_label,
      question.related_content_id::text
    FROM quiz_questions AS question
    LEFT JOIN quiz_choices AS selected
      ON selected.question_id = question.id AND selected.id = ${choiceId}
    LEFT JOIN quiz_choices AS correct_choice
      ON correct_choice.question_id = question.id AND correct_choice.id = question.correct_choice_id
    LEFT JOIN LATERAL (
      SELECT value.explanation, value.source_label
      FROM quiz_question_translations AS value
      JOIN locale_preference AS preference ON preference.locale = value.locale
      WHERE value.question_id = question.id
      ORDER BY preference.priority
      LIMIT 1
    ) AS translation ON TRUE
    LEFT JOIN LATERAL (
      SELECT value.label
      FROM quiz_choice_translations AS value
      JOIN locale_preference AS preference ON preference.locale = value.locale
      WHERE value.question_id = correct_choice.question_id AND value.choice_id = correct_choice.id
      ORDER BY preference.priority
      LIMIT 1
    ) AS correct_translation ON TRUE
    WHERE question.id = ${questionId} AND question.is_published = TRUE
  `) as DbRow[];
  const parsed = parseAnswerRow(rows, choiceId);
  const base: QuizAnswerResult = {
    status: choiceId === parsed.correctChoiceId ? "correct" : "incorrect",
    correctChoiceId: parsed.correctChoiceId,
    correctChoiceLabel: parsed.correctChoiceLabel,
    explanation: parsed.explanation,
    source: { label: parsed.sourceLabel, url: parsed.sourceUrl },
  };
  if (!parsed.relatedContentId) return base;

  try {
    const content = await getPublishedContentById(parsed.relatedContentId, locale);
    if (content?.kind === "guide") {
      return { ...base, relatedGuide: { slug: content.slug, label: content.title } };
    }
  } catch {
    // 補助導線の障害や不完全なContentでは、採点結果自体を失敗させません。
  }
  return base;
}

/**
 * DraftとPublishedを含む管理Question一覧を更新日時順で取得します。
 * @returns {Promise<readonly AdminQuizListItem[]>} DB未設定時は空配列。
 */
export async function listAdminQuizQuestions(): Promise<readonly AdminQuizListItem[]> {
  if (!process.env.DATABASE_URL) return [];
  const rows = (await getRequiredSql()`
    SELECT question.id, question.category, question.special_month, question.special_day,
      question.correct_choice_id, question.source_url, question.related_content_id::text,
      question.is_published, question.created_at, question.updated_at,
      COALESCE(ja.question, '') AS question_ja,
      COALESCE(en.question, '') AS question_en,
      COUNT(choice.id)::int AS choice_count
    FROM quiz_questions AS question
    LEFT JOIN quiz_question_translations AS ja
      ON ja.question_id = question.id AND ja.locale = 'ja'
    LEFT JOIN quiz_question_translations AS en
      ON en.question_id = question.id AND en.locale = 'en'
    LEFT JOIN quiz_choices AS choice ON choice.question_id = question.id
    GROUP BY question.id, ja.question, en.question
    ORDER BY question.updated_at DESC, question.id
  `) as DbRow[];
  return rows.map(toAdminQuizListItem);
}

/**
 * 指定IDの管理Questionを日英翻訳・Choiceとともに取得します。
 * @param {string} id Question ID。
 * @returns {Promise<AdminQuizQuestion | null>} DB未設定または対象なしの場合はnull。
 */
export async function getAdminQuizQuestion(id: string): Promise<AdminQuizQuestion | null> {
  requiredNonEmptyString(id);
  if (!process.env.DATABASE_URL) return null;
  const rows = (await getRequiredSql()`
    SELECT question.id, question.category, question.special_month, question.special_day,
      question.correct_choice_id, question.source_url, question.related_content_id::text,
      question.is_published, question.created_at, question.updated_at,
      COALESCE(ja.question, '') AS question_ja,
      COALESCE(ja.explanation, '') AS explanation_ja,
      COALESCE(ja.source_label, '') AS source_label_ja,
      COALESCE(en.question, '') AS question_en,
      COALESCE(en.explanation, '') AS explanation_en,
      COALESCE(en.source_label, '') AS source_label_en,
      choice.id AS choice_id, choice.sort_order,
      COALESCE(choice_ja.label, '') AS choice_label_ja,
      COALESCE(choice_en.label, '') AS choice_label_en
    FROM quiz_questions AS question
    LEFT JOIN quiz_question_translations AS ja
      ON ja.question_id = question.id AND ja.locale = 'ja'
    LEFT JOIN quiz_question_translations AS en
      ON en.question_id = question.id AND en.locale = 'en'
    LEFT JOIN quiz_choices AS choice ON choice.question_id = question.id
    LEFT JOIN quiz_choice_translations AS choice_ja
      ON choice_ja.question_id = choice.question_id AND choice_ja.choice_id = choice.id AND choice_ja.locale = 'ja'
    LEFT JOIN quiz_choice_translations AS choice_en
      ON choice_en.question_id = choice.question_id AND choice_en.choice_id = choice.id AND choice_en.locale = 'en'
    WHERE question.id = ${id}
    ORDER BY choice.sort_order, choice.id
  `) as DbRow[];
  return rows.length === 0 ? null : toAdminQuizQuestion(rows);
}

/**
 * Question・日英翻訳・Choiceを単一transactionでDraft作成します。
 * @param {string} id 新しいQuestion ID。
 * @param {AdminQuizWriteInput} input Question全体のスナップショット。
 * @returns {Promise<void>} transaction完了時に解決します。
 */
export async function insertAdminQuizQuestion(id: string, input: AdminQuizWriteInput): Promise<void> {
  rejectE2ETestMutation();
  validateAdminWriteInput(id, input);
  const sql = getRequiredSql();
  await sql.transaction(
    (transaction) => [
      transaction`
        INSERT INTO quiz_questions (
          id, category, special_month, special_day, correct_choice_id, source_url, related_content_id
        ) VALUES (
          ${id}, ${input.category}, ${input.specialDate?.month ?? null}, ${input.specialDate?.day ?? null},
          ${input.correctChoiceId}, ${input.sourceUrl}, ${input.relatedContentId}::uuid
        )
      `,
      ...questionTranslationQueries(transaction, id, input),
      ...choiceQueries(transaction, id, input.choices),
    ],
    { isolationLevel: "ReadCommitted" },
  );
}

/**
 * 公開状態を維持してQuestion・翻訳・Choiceを単一transactionで全体更新します。
 * @param {string} id 更新対象Question ID。
 * @param {AdminQuizWriteInput} input 更新後スナップショット。
 * @returns {Promise<AdminQuizUpdateResult>} 更新・対象なし・公開条件不足の結果。
 */
export async function replaceAdminQuizQuestion(id: string, input: AdminQuizWriteInput): Promise<AdminQuizUpdateResult> {
  rejectE2ETestMutation();
  validateAdminWriteInput(id, input);
  const sql = getRequiredSql();
  const publishReady = isPublishReady(input);
  const results = (await sql.transaction(
    (transaction) => [
      transaction`SELECT id, is_published FROM quiz_questions WHERE id = ${id} FOR UPDATE`,
      transaction`
        UPDATE quiz_questions AS question
        SET category = ${input.category},
          special_month = ${input.specialDate?.month ?? null},
          special_day = ${input.specialDate?.day ?? null},
          correct_choice_id = ${input.correctChoiceId},
          source_url = ${input.sourceUrl},
          related_content_id = ${input.relatedContentId}::uuid,
          updated_at = NOW()
        WHERE question.id = ${id} AND (question.is_published = FALSE OR ${publishReady})
        RETURNING question.id
      `,
      ...questionTranslationQueries(transaction, id, input, true, publishReady),
      transaction`
        DELETE FROM quiz_choices AS choice
        WHERE choice.question_id = ${id}
          AND EXISTS (
            SELECT 1 FROM quiz_questions AS question
            WHERE question.id = ${id} AND (question.is_published = FALSE OR ${publishReady})
          )
      `,
      ...choiceQueries(transaction, id, input.choices, true, publishReady),
    ],
    { isolationLevel: "ReadCommitted" },
  )) as DbRow[][];
  if (results[0].length === 0) return "not_found";
  return results[1].length === 0 ? "publication_blocked" : "updated";
}

/**
 * 行ロックと公開条件のDB再検証を伴ってPublish / Unpublishします。
 * @param {string} id 対象Question ID。
 * @param {boolean} isPublished 変更後の公開状態。
 * @returns {Promise<AdminQuizPublicationResult | null>} 対象なしの場合はnull。
 */
export async function setAdminQuizPublication(
  id: string,
  isPublished: boolean,
): Promise<AdminQuizPublicationResult | null> {
  rejectE2ETestMutation();
  requiredNonEmptyString(id);
  const sql = getRequiredSql();
  const [lockedRows, updatedRows] = (await sql.transaction(
    (transaction) => [
      transaction`SELECT id, is_published FROM quiz_questions WHERE id = ${id} FOR UPDATE`,
      transaction`
        UPDATE quiz_questions AS question
        SET is_published = ${isPublished}, updated_at = NOW()
        WHERE question.id = ${id}
          AND question.is_published <> ${isPublished}
          AND (
            ${isPublished} = FALSE
            OR (
              question.category IS NOT NULL AND btrim(question.category) <> ''
AND question.category = ANY(${QUIZ_CATEGORIES}::text[])
              AND question.correct_choice_id IS NOT NULL AND btrim(question.correct_choice_id) <> ''
              AND question.source_url IS NOT NULL AND btrim(question.source_url) <> ''
AND LOWER(question.source_url) LIKE 'https://%'
              AND EXISTS (
                SELECT 1 FROM quiz_choices AS correct_choice
                WHERE correct_choice.question_id = question.id
                  AND correct_choice.id = question.correct_choice_id
              )
              AND (SELECT COUNT(*) FROM quiz_choices AS choice WHERE choice.question_id = question.id) = 4
              AND NOT EXISTS (
                SELECT 1 FROM (VALUES ('ja'), ('en')) AS required(locale)
                WHERE NOT EXISTS (
                  SELECT 1 FROM quiz_question_translations AS translation
                  WHERE translation.question_id = question.id
                    AND translation.locale = required.locale
                    AND btrim(translation.question) <> ''
                    AND btrim(translation.explanation) <> ''
                    AND btrim(translation.source_label) <> ''
                )
              )
              AND NOT EXISTS (
                SELECT 1 FROM quiz_choices AS choice
                CROSS JOIN (VALUES ('ja'), ('en')) AS required(locale)
                WHERE choice.question_id = question.id
                  AND NOT EXISTS (
                    SELECT 1 FROM quiz_choice_translations AS translation
                    WHERE translation.question_id = choice.question_id
                      AND translation.choice_id = choice.id
                      AND translation.locale = required.locale
                      AND btrim(translation.label) <> ''
                  )
              )
            )
          )
        RETURNING question.id, question.is_published
      `,
    ],
    { isolationLevel: "ReadCommitted" },
  )) as [DbRow[], DbRow[]];
  if (lockedRows.length === 0) return null;
  const current = requiredBoolean(lockedRows[0].is_published);
  if (current === isPublished) return { id, isPublished, unchanged: true };
  if (updatedRows.length === 0) return { id, isPublished: current, unchanged: true };
  return { id, isPublished: requiredBoolean(updatedRows[0].is_published), unchanged: false };
}

/**
 * DBの公開Question行を回答前DTOへ厳密に変換します。
 * @param {DbRow[]} rows QuestionとChoiceの結合行。
 * @returns {readonly PublicQuizQuestion[]} Choice順を保証した公開Question。
 */
export function parsePublishedQuizRows(rows: DbRow[]): readonly PublicQuizQuestion[] {
  const questions = new Map<string, PublicQuestionBuilder>();
  for (const row of rows) {
    const id = requiredNonEmptyString(row.id);
    const category = requiredCategory(row.category);
    const question = requiredNonEmptyString(row.question);
    const specialDate = parseSpecialDate(row.special_month, row.special_day, undefined);
    const choice = {
      id: requiredNonEmptyString(row.choice_id),
      label: requiredNonEmptyString(row.choice_label),
      sortOrder: requiredNonNegativeInteger(row.sort_order),
    };
    const existing = questions.get(id);
    if (!existing) {
      questions.set(id, { id, category, question, ...(specialDate ? { specialDate } : {}), choices: [choice] });
      continue;
    }
    if (
      existing.category !== category ||
      existing.question !== question ||
      !sameSpecialDate(existing.specialDate, specialDate) ||
      existing.choices.some((item) => item.id === choice.id || item.sortOrder === choice.sortOrder)
    ) {
      throw invalidDatabaseQuiz();
    }
    existing.choices.push(choice);
  }
  return [...questions.values()].map((question) => {
    if (question.choices.length !== 4) throw invalidDatabaseQuiz();
    return {
      ...question,
      choices: question.choices
        .toSorted((left, right) => left.sortOrder - right.sortOrder)
        .map(({ id, label }) => ({ id, label })),
    };
  });
}

function parseAnswerRow(rows: DbRow[], selectedChoiceId: string) {
  if (rows.length === 0) throw new Error("Quiz question was not found");
  if (rows.length !== 1) throw invalidDatabaseQuiz();
  const row = rows[0];
  requiredNonEmptyString(row.id);
  if (row.selected_choice_id !== selectedChoiceId) throw new Error("Quiz choice was not found");
  const correctChoiceId = requiredNonEmptyString(row.correct_choice_id);
  if (row.resolved_correct_choice_id !== correctChoiceId) throw invalidDatabaseQuiz();
  return {
    correctChoiceId,
    correctChoiceLabel: requiredNonEmptyString(row.correct_choice_label),
    explanation: requiredNonEmptyString(row.explanation),
    sourceLabel: requiredNonEmptyString(row.source_label),
    sourceUrl: requiredHttpsUrl(row.source_url),
    relatedContentId: nullableUuid(row.related_content_id),
  };
}

function toAdminQuizListItem(row: DbRow): AdminQuizListItem {
  return {
    ...toAdminQuizBase(row),
    questionJa: requiredString(row.question_ja),
    questionEn: requiredString(row.question_en),
    choiceCount: requiredNonNegativeInteger(row.choice_count),
  };
}

function toAdminQuizQuestion(rows: DbRow[]): AdminQuizQuestion {
  const base = toAdminQuizBase(rows[0]);
  const translations = {
    ja: {
      question: requiredString(rows[0].question_ja),
      explanation: requiredString(rows[0].explanation_ja),
      sourceLabel: requiredString(rows[0].source_label_ja),
    },
    en: {
      question: requiredString(rows[0].question_en),
      explanation: requiredString(rows[0].explanation_en),
      sourceLabel: requiredString(rows[0].source_label_en),
    },
  };
  const choices: AdminQuizChoice[] = [];
  for (const row of rows) {
    if (requiredNonEmptyString(row.id) !== base.id) throw invalidDatabaseQuiz();
    if (row.choice_id === null || row.choice_id === undefined) {
      if (rows.length !== 1) throw invalidDatabaseQuiz();
      continue;
    }
    const choice = {
      id: requiredNonEmptyString(row.choice_id),
      sortOrder: requiredNonNegativeInteger(row.sort_order),
      translations: {
        ja: requiredString(row.choice_label_ja),
        en: requiredString(row.choice_label_en),
      },
    };
    if (choices.some((item) => item.id === choice.id || item.sortOrder === choice.sortOrder)) {
      throw invalidDatabaseQuiz();
    }
    choices.push(choice);
  }
  const question = { ...base, translations, choices: choices.toSorted((a, b) => a.sortOrder - b.sortOrder) };
  if (question.isPublished && !isPublishReady(question)) throw invalidDatabaseQuiz();
  return question;
}

function toAdminQuizBase(row: DbRow) {
  return {
    id: requiredNonEmptyString(row.id),
    category: nullableCategory(row.category),
    specialDate: parseSpecialDate(row.special_month, row.special_day, null),
    correctChoiceId: nullableNonEmptyString(row.correct_choice_id),
    sourceUrl: nullableHttpsUrl(row.source_url),
    relatedContentId: nullableUuid(row.related_content_id),
    isPublished: requiredBoolean(row.is_published),
    createdAt: requiredDate(row.created_at),
    updatedAt: requiredDate(row.updated_at),
  };
}

function questionTranslationQueries(
  transaction: NeonQueryFunctionInTransaction<boolean, boolean>,
  id: string,
  input: AdminQuizWriteInput,
  requireExisting = false,
  publishReady = true,
) {
  return (["ja", "en"] as const).map((locale) => {
    const value = input.translations[locale];
    return transaction`
      INSERT INTO quiz_question_translations (question_id, locale, question, explanation, source_label)
      SELECT ${id}, ${locale}, ${value.question}, ${value.explanation}, ${value.sourceLabel}
      WHERE ${requireExisting} = FALSE OR EXISTS (
        SELECT 1 FROM quiz_questions AS question
        WHERE question.id = ${id} AND (question.is_published = FALSE OR ${publishReady})
      )
      ON CONFLICT (question_id, locale) DO UPDATE
      SET question = EXCLUDED.question, explanation = EXCLUDED.explanation,
        source_label = EXCLUDED.source_label, updated_at = NOW()
    `;
  });
}

function choiceQueries(
  transaction: NeonQueryFunctionInTransaction<boolean, boolean>,
  questionId: string,
  choices: readonly AdminQuizChoice[],
  requireExisting = false,
  publishReady = true,
) {
  return choices.flatMap((choice) => [
    transaction`
      INSERT INTO quiz_choices (question_id, id, sort_order)
      SELECT ${questionId}, ${choice.id}, ${choice.sortOrder}
      WHERE ${requireExisting} = FALSE OR EXISTS (
        SELECT 1 FROM quiz_questions AS question
        WHERE question.id = ${questionId} AND (question.is_published = FALSE OR ${publishReady})
      )
    `,
    ...(["ja", "en"] as const).map(
      (locale) => transaction`
      INSERT INTO quiz_choice_translations (question_id, choice_id, locale, label)
      SELECT ${questionId}, ${choice.id}, ${locale}, ${choice.translations[locale]}
      WHERE EXISTS (
        SELECT 1 FROM quiz_choices AS stored
        WHERE stored.question_id = ${questionId} AND stored.id = ${choice.id}
      )
        AND (
          ${requireExisting} = FALSE OR EXISTS (
            SELECT 1 FROM quiz_questions AS question
            WHERE question.id = ${questionId} AND (question.is_published = FALSE OR ${publishReady})
          )
        )
    `,
    ),
  ]);
}

function validateAdminWriteInput(id: string, input: AdminQuizWriteInput) {
  requiredNonEmptyString(id);
  if (input.category !== null && !isQuizCategory(input.category)) throw new Error("Invalid quiz write input.");
  if (input.specialDate !== null) validateSpecialDate(input.specialDate);
  if (input.correctChoiceId !== null) requiredNonEmptyString(input.correctChoiceId);
  if (input.sourceUrl !== null) requiredHttpsUrl(input.sourceUrl);
  if (input.relatedContentId !== null) requiredUuid(input.relatedContentId);
  for (const locale of ["ja", "en"] as const) {
    const translation = input.translations[locale];
    requiredString(translation.question);
    requiredString(translation.explanation);
    requiredString(translation.sourceLabel);
  }
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const choice of input.choices) {
    const choiceId = requiredNonEmptyString(choice.id);
    const order = requiredNonNegativeInteger(choice.sortOrder);
    if (ids.has(choiceId) || orders.has(order)) throw new Error("Invalid quiz write input.");
    ids.add(choiceId);
    orders.add(order);
    requiredString(choice.translations.ja);
    requiredString(choice.translations.en);
  }
  if (input.correctChoiceId !== null && !ids.has(input.correctChoiceId)) throw new Error("Invalid quiz write input.");
}

function isPublishReady(input: AdminQuizWriteInput | AdminQuizQuestion) {
  return Boolean(
    input.category &&
    input.correctChoiceId &&
    input.sourceUrl &&
    input.translations.ja.question.trim() &&
    input.translations.ja.explanation.trim() &&
    input.translations.ja.sourceLabel.trim() &&
    input.translations.en.question.trim() &&
    input.translations.en.explanation.trim() &&
    input.translations.en.sourceLabel.trim() &&
    input.choices.length === 4 &&
    input.choices.some((choice) => choice.id === input.correctChoiceId) &&
    input.choices.every((choice) => choice.translations.ja.trim() && choice.translations.en.trim()),
  );
}

function parseSpecialDate<T extends null | undefined>(month: unknown, day: unknown, empty: T): QuizSpecialDate | T {
  if ((month === null || month === undefined) && (day === null || day === undefined)) return empty;
  if (!Number.isInteger(month) || !Number.isInteger(day)) throw invalidDatabaseQuiz();
  const value = { month: month as number, day: day as number };
  validateSpecialDate(value);
  return value;
}

function validateSpecialDate(value: QuizSpecialDate) {
  if (!Number.isInteger(value.month) || !Number.isInteger(value.day) || value.month < 1 || value.month > 12) {
    throw new Error("Invalid quiz date.");
  }
  const maximum = new Date(Date.UTC(2000, value.month, 0)).getUTCDate();
  if (value.day < 1 || value.day > maximum) throw new Error("Invalid quiz date.");
}

function sameSpecialDate(left: QuizSpecialDate | undefined, right: QuizSpecialDate | undefined) {
  return left?.month === right?.month && left?.day === right?.day;
}

function requireLocale(locale: string): asserts locale is Locale {
  if (!isSupportedLocale(locale)) throw new Error("Unsupported quiz locale.");
}

function requiredCategory(value: unknown): QuizCategory {
  const category = requiredNonEmptyString(value);
  if (!isQuizCategory(category)) throw invalidDatabaseQuiz();
  return category;
}

function nullableCategory(value: unknown): QuizCategory | null {
  return value === null || value === undefined ? null : requiredCategory(value);
}

function requiredString(value: unknown) {
  if (typeof value !== "string") throw invalidDatabaseQuiz();
  return value;
}

function requiredNonEmptyString(value: unknown) {
  const text = requiredString(value);
  if (!text.trim()) throw invalidDatabaseQuiz();
  return text;
}

function nullableNonEmptyString(value: unknown) {
  return value === null || value === undefined ? null : requiredNonEmptyString(value);
}

function requiredBoolean(value: unknown) {
  if (typeof value !== "boolean") throw invalidDatabaseQuiz();
  return value;
}

function requiredNonNegativeInteger(value: unknown) {
  if (!Number.isInteger(value) || (value as number) < 0) throw invalidDatabaseQuiz();
  return value as number;
}

function requiredDate(value: unknown) {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.valueOf())) throw invalidDatabaseQuiz();
  return date.toISOString();
}

function requiredHttpsUrl(value: unknown) {
  const text = requiredNonEmptyString(value);
  try {
    if (new URL(text).protocol !== "https:") throw invalidDatabaseQuiz();
  } catch {
    throw invalidDatabaseQuiz();
  }
  return text;
}

function nullableHttpsUrl(value: unknown) {
  return value === null || value === undefined ? null : requiredHttpsUrl(value);
}

function requiredUuid(value: unknown) {
  const text = requiredNonEmptyString(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(text)) {
    throw invalidDatabaseQuiz();
  }
  return text;
}

function nullableUuid(value: unknown) {
  return value === null || value === undefined ? null : requiredUuid(value);
}

function invalidDatabaseQuiz() {
  return new Error("Invalid quiz data returned from database.");
}

function getRequiredSql() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  sqlClient ??= neon(process.env.DATABASE_URL);
  return sqlClient;
}
