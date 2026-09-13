import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

export const QUIZ_SOURCE_PATH = "apps/web/data/ireland/quiz.json";
const LOCALES = ["ja", "en"];
const QUIZ_CATEGORIES = [
  "ireland-basics",
  "pub-guinness",
  "irish-whiskey",
  "irish-music",
  "irish-sports",
  "literature",
  "myth-folklore",
  "history",
];

function invalid(path, message) {
  throw new Error(`Invalid quiz data at ${path}: ${message}`);
}

function object(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(path, "must be an object");
  return value;
}

function requiredString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) invalid(path, "must be a non-empty string");
  return value;
}

function localized(value, path) {
  const input = object(value, path);
  return { ja: requiredString(input.ja, `${path}.ja`), en: requiredString(input.en, `${path}.en`) };
}

function parseDate(value, path) {
  const input = object(value, path);
  if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12) {
    invalid(`${path}.month`, "must be an integer between 1 and 12");
  }
  if (!Number.isInteger(input.day)) invalid(`${path}.day`, "must be an integer");
  const maximum = new Date(Date.UTC(2000, input.month, 0)).getUTCDate();
  if (input.day < 1 || input.day > maximum) invalid(`${path}.day`, `must be valid for month ${input.month}`);
  return { month: input.month, day: input.day };
}

function parseSource(value, path) {
  const input = object(value, path);
  const url = requiredString(input.url, `${path}.url`);
  try {
    if (new URL(url).protocol !== "https:") invalid(`${path}.url`, "must use HTTPS");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid quiz data")) throw error;
    invalid(`${path}.url`, "must be a valid HTTPS URL");
  }
  return { label: localized(input.label, `${path}.label`), url };
}

function parseRelatedGuide(value, path) {
  const input = object(value, path);
  const slug = requiredString(input.slug, `${path}.slug`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) invalid(`${path}.slug`, "must be a kebab-case slug");
  return { slug, label: localized(input.label, `${path}.label`) };
}

function parseChoice(value, path) {
  const input = object(value, path);
  return { id: requiredString(input.id, `${path}.id`), label: localized(input.label, `${path}.label`) };
}

function parseQuestion(value, index) {
  const basePath = `questions[${index}]`;
  const input = object(value, basePath);
  const id = requiredString(input.id, `${basePath}.id`);
  const category = requiredString(input.category, `${basePath}(${id}).category`);
  if (!QUIZ_CATEGORIES.includes(category)) invalid(`${basePath}(${id}).category`, `unsupported category "${category}"`);
  if (!Array.isArray(input.choices) || input.choices.length !== 4) {
    invalid(`${basePath}(${id}).choices`, "must contain exactly four choices");
  }
  const choices = input.choices.map((choice, choiceIndex) =>
    parseChoice(choice, `${basePath}(${id}).choices[${choiceIndex}]`),
  );
  const choiceIds = new Set();
  choices.forEach((choice, choiceIndex) => {
    if (choiceIds.has(choice.id))
      invalid(`${basePath}(${id}).choices[${choiceIndex}].id`, "must be unique within the question");
    choiceIds.add(choice.id);
  });
  const answer = requiredString(input.answer, `${basePath}(${id}).answer`);
  if (!choiceIds.has(answer)) invalid(`${basePath}(${id}).answer`, "must reference an existing choice ID");
  return {
    id,
    category,
    question: localized(input.question, `${basePath}(${id}).question`),
    choices,
    answer,
    explanation: localized(input.explanation, `${basePath}(${id}).explanation`),
    source: parseSource(input.source, `${basePath}(${id}).source`),
    ...(input.specialDate === undefined
      ? {}
      : { specialDate: parseDate(input.specialDate, `${basePath}(${id}).specialDate`) }),
    ...(input.relatedGuide === undefined
      ? {}
      : { relatedGuide: parseRelatedGuide(input.relatedGuide, `${basePath}(${id}).relatedGuide`) }),
  };
}

/**
 * Migration元JSONを検証し、DBへ投入可能な不変条件を満たす値へ変換します。
 * @param {unknown} value 検証対象のJSON値。
 * @returns {object} 検証済みQuizデータ。
 */
export function parseQuizData(value) {
  const input = object(value, "root");
  if (input.schemaVersion !== 1) invalid("schemaVersion", "must be 1");
  if (input.country !== "IE") invalid("country", 'must be "IE"');
  const categoryInput = object(input.categories, "categories");
  for (const category of QUIZ_CATEGORIES) {
    const item = object(categoryInput[category], `categories.${category}`);
    requiredString(item.icon, `categories.${category}.icon`);
    localized(item.label, `categories.${category}.label`);
  }
  if (!Array.isArray(input.questions) || input.questions.length === 0)
    invalid("questions", "must be a non-empty array");
  const questions = input.questions.map(parseQuestion);
  const ids = new Set();
  questions.forEach((question, index) => {
    if (ids.has(question.id)) invalid(`questions[${index}](${question.id}).id`, "must be unique");
    ids.add(question.id);
  });
  return { schemaVersion: 1, country: "IE", categories: categoryInput, questions };
}

/**
 * 固定JSONを読み込みます。任意の入力ファイルは受け付けません。
 * @returns {Promise<object>} JSONから読み込んだ値。
 */
export async function loadQuizSource() {
  const text = await readFile(resolve(process.cwd(), QUIZ_SOURCE_PATH), "utf8");
  try {
    return parseQuizData(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON source: ${QUIZ_SOURCE_PATH}`);
    throw error;
  }
}

/**
 * Related Guideのslugを公開済みGuideのUUIDへ厳密に解決します。
 * @param {Function} sql Neon SQL tagged template関数。
 * @param {object} data 検証済みQuizデータ。
 * @returns {Promise<Map<string, string>>} slugからContent UUIDへの対応表。
 */
export async function resolveRelatedContent(sql, data) {
  const slugs = [
    ...new Set(data.questions.flatMap((question) => (question.relatedGuide ? [question.relatedGuide.slug] : []))),
  ];
  const relatedContent = new Map();
  for (const slug of slugs) {
    const rows = await sql`
      SELECT entry.id::text AS id
      FROM content_entries AS entry
      JOIN content_translations AS ja
        ON ja.content_id = entry.id AND ja.locale = 'ja'
      JOIN content_translations AS en
        ON en.content_id = entry.id AND en.locale = 'en'
      WHERE entry.kind = 'guide'
        AND entry.slug = ${slug}
        AND entry.status = 'published'
        AND btrim(ja.title) <> ''
        AND btrim(ja.summary) <> ''
        AND btrim(ja.body_markdown) <> ''
        AND btrim(en.title) <> ''
        AND btrim(en.summary) <> ''
        AND btrim(en.body_markdown) <> ''
    `;
    if (rows.length !== 1 || typeof rows[0].id !== "string" || rows[0].id.trim().length === 0) {
      throw new Error(`Related Guide cannot be resolved: ${slug}`);
    }
    relatedContent.set(slug, rows[0].id);
  }
  return relatedContent;
}

/**
 * 検証済みJSONをDBへ投入する期待Snapshotへ変換します。
 * @param {object} data 検証済みQuizデータ。
 * @param {Map<string, string>} relatedContent Related Guideの解決結果。
 * @returns {object} DB比較・INSERTに使用するSnapshot。
 */
export function buildExpectedSnapshot(data, relatedContent = new Map()) {
  const questions = data.questions.map((question) => ({
    id: question.id,
    category: question.category,
    special_month: question.specialDate?.month ?? null,
    special_day: question.specialDate?.day ?? null,
    correct_choice_id: question.answer,
    source_url: question.source.url,
    related_content_id: question.relatedGuide
      ? requireRelatedContentId(relatedContent, question.relatedGuide.slug)
      : null,
    is_published: true,
    translations: LOCALES.map((locale) => ({
      locale,
      question: question.question[locale],
      explanation: question.explanation[locale],
      source_label: question.source.label[locale],
    })),
    choices: question.choices.map((choice, sort_order) => ({
      id: choice.id,
      sort_order,
      translations: LOCALES.map((locale) => ({ locale, label: choice.label[locale] })),
    })),
  }));
  return {
    questions,
    rowCounts: {
      questions: questions.length,
      questionTranslations: questions.reduce((count, question) => count + question.translations.length, 0),
      choices: questions.reduce((count, question) => count + question.choices.length, 0),
      choiceTranslations: questions.reduce(
        (count, question) =>
          count + question.choices.reduce((choiceCount, choice) => choiceCount + choice.translations.length, 0),
        0,
      ),
    },
  };
}

function requireRelatedContentId(relatedContent, slug) {
  const id = relatedContent.get(slug);
  if (typeof id !== "string" || id.trim().length === 0) throw new Error("Related Guide cannot be resolved: " + slug);
  return id;
}

function sortSnapshot(snapshot) {
  return {
    questions: [...snapshot.questions]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((question) => ({
        ...question,
        translations: [...question.translations].sort((left, right) => left.locale.localeCompare(right.locale)),
        choices: [...question.choices]
          .sort((left, right) => left.sort_order - right.sort_order || left.id.localeCompare(right.id))
          .map((choice) => ({
            ...choice,
            translations: [...choice.translations].sort((left, right) => left.locale.localeCompare(right.locale)),
          })),
      })),
    rowCounts: snapshot.rowCounts,
  };
}

/**
 * 期待SnapshotとDB Snapshotが完全一致するか判定します。
 * @param {object} left 比較対象。
 * @param {object} right 比較対象。
 * @returns {boolean} 完全一致ならtrue。
 */
export function snapshotsEqual(left, right) {
  return JSON.stringify(sortSnapshot(left)) === JSON.stringify(sortSnapshot(right));
}

/**
 * DBの現在状態を空・完全移行済み・不一致に分類します。
 * @param {object} current 現在のDB Snapshot。
 * @param {object} expected 期待Snapshot。
 * @returns {"empty"|"already_migrated"|"inconsistent"} 状態。
 */
export function classifyQuizState(current, expected) {
  if (Object.values(current.rowCounts).every((count) => count === 0)) return "empty";
  return snapshotsEqual(current, expected) ? "already_migrated" : "inconsistent";
}

function requiredDbString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`Invalid Quiz database value: ${field}`);
  return value;
}

function nullableDbString(value, field) {
  if (value === null || value === undefined) return null;
  return requiredDbString(value, field);
}

function requiredDbInteger(value, field) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed)) throw new Error(`Invalid Quiz database value: ${field}`);
  return parsed;
}

function requiredDbBoolean(value, field) {
  if (typeof value !== "boolean") throw new Error(`Invalid Quiz database value: ${field}`);
  return value;
}

/**
 * NeonのQuiz全行を比較用Snapshotへ変換します。
 * @param {Array<object>} questionRows Question行。
 * @param {Array<object>} questionTranslationRows Question翻訳行。
 * @param {Array<object>} choiceRows Choice行。
 * @param {Array<object>} choiceTranslationRows Choice翻訳行。
 * @returns {object} DB Snapshot。
 */
export function buildDatabaseSnapshot(questionRows, questionTranslationRows, choiceRows, choiceTranslationRows) {
  const questions = questionRows.map((row) => ({
    id: requiredDbString(row.id, "quiz_questions.id"),
    category: nullableDbString(row.category, "quiz_questions.category"),
    special_month:
      row.special_month === null || row.special_month === undefined
        ? null
        : requiredDbInteger(row.special_month, "quiz_questions.special_month"),
    special_day:
      row.special_day === null || row.special_day === undefined
        ? null
        : requiredDbInteger(row.special_day, "quiz_questions.special_day"),
    correct_choice_id: nullableDbString(row.correct_choice_id, "quiz_questions.correct_choice_id"),
    source_url: nullableDbString(row.source_url, "quiz_questions.source_url"),
    related_content_id: nullableDbString(row.related_content_id, "quiz_questions.related_content_id"),
    is_published: requiredDbBoolean(row.is_published, "quiz_questions.is_published"),
    translations: questionTranslationRows
      .filter((translation) => translation.question_id === row.id)
      .map((translation) => ({
        locale: requiredDbString(translation.locale, "quiz_question_translations.locale"),
        question: requiredDbString(translation.question, "quiz_question_translations.question"),
        explanation: requiredDbString(translation.explanation, "quiz_question_translations.explanation"),
        source_label: requiredDbString(translation.source_label, "quiz_question_translations.source_label"),
      })),
    choices: choiceRows
      .filter((choice) => choice.question_id === row.id)
      .map((choice) => ({
        id: requiredDbString(choice.id, "quiz_choices.id"),
        sort_order: requiredDbInteger(choice.sort_order, "quiz_choices.sort_order"),
        translations: choiceTranslationRows
          .filter((translation) => translation.question_id === row.id && translation.choice_id === choice.id)
          .map((translation) => ({
            locale: requiredDbString(translation.locale, "quiz_choice_translations.locale"),
            label: requiredDbString(translation.label, "quiz_choice_translations.label"),
          })),
      })),
  }));
  return {
    questions,
    rowCounts: {
      questions: questionRows.length,
      questionTranslations: questionTranslationRows.length,
      choices: choiceRows.length,
      choiceTranslations: choiceTranslationRows.length,
    },
  };
}

/**
 * DBからQuiz全テーブルを読み取ります。
 * @param {Function} sql Neon SQL tagged template関数。
 * @returns {Promise<object>} DB Snapshot。
 */
export async function readQuizSnapshot(sql) {
  const [questions, questionTranslations, choices, choiceTranslations] = await Promise.all([
    sql`SELECT id, category, special_month, special_day, correct_choice_id, source_url, related_content_id::text, is_published FROM quiz_questions ORDER BY id`,
    sql`SELECT question_id, locale, question, explanation, source_label FROM quiz_question_translations ORDER BY question_id, locale`,
    sql`SELECT question_id, id, sort_order FROM quiz_choices ORDER BY question_id, sort_order, id`,
    sql`SELECT question_id, choice_id, locale, label FROM quiz_choice_translations ORDER BY question_id, choice_id, locale`,
  ]);
  return buildDatabaseSnapshot(questions, questionTranslations, choices, choiceTranslations);
}

/**
 * Snapshotを単一transactionへINSERTするQuery列を作成します。
 * @param {Function} transaction Neon transaction tagged template関数。
 * @param {object} snapshot INSERT対象Snapshot。
 * @returns {Array<Promise<unknown>>} 実行するQuery列。
 */
export function buildInsertQueries(transaction, snapshot) {
  const queries = [];
  for (const question of snapshot.questions) {
    queries.push(transaction`
      INSERT INTO quiz_questions (
        id, category, special_month, special_day, correct_choice_id, source_url, related_content_id, is_published
      ) VALUES (
        ${question.id}, ${question.category}, ${question.special_month}, ${question.special_day},
        ${question.correct_choice_id}, ${question.source_url}, ${question.related_content_id}::uuid, ${question.is_published}
      )
    `);
    for (const translation of question.translations) {
      queries.push(transaction`
        INSERT INTO quiz_question_translations (question_id, locale, question, explanation, source_label)
        VALUES (${question.id}, ${translation.locale}, ${translation.question}, ${translation.explanation}, ${translation.source_label})
      `);
    }
    for (const choice of question.choices) {
      queries.push(transaction`
        INSERT INTO quiz_choices (question_id, id, sort_order)
        VALUES (${question.id}, ${choice.id}, ${choice.sort_order})
      `);
      for (const translation of choice.translations) {
        queries.push(transaction`
          INSERT INTO quiz_choice_translations (question_id, choice_id, locale, label)
          VALUES (${question.id}, ${choice.id}, ${translation.locale}, ${translation.label})
        `);
      }
    }
  }
  return queries;
}

/**
 * Quiz全テーブルの空状態検査とINSERTを同一transactionで実行するQuery列を作成します。
 * テーブルロックにより、Preflight後に別処理がQuiz行を追加する競合も検出して全体をrollbackします。
 * @param {Function} transaction Neon transaction tagged template関数。
 * @param {object} snapshot INSERT対象Snapshot。
 * @returns {Array<Promise<unknown>>} 実行するQuery列。
 */
export function buildApplyQueries(transaction, snapshot) {
  return [
    transaction`
      LOCK TABLE
        quiz_questions,
        quiz_question_translations,
        quiz_choices,
        quiz_choice_translations
      IN SHARE ROW EXCLUSIVE MODE
    `,
    transaction`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM quiz_questions)
          OR EXISTS (SELECT 1 FROM quiz_question_translations)
          OR EXISTS (SELECT 1 FROM quiz_choices)
          OR EXISTS (SELECT 1 FROM quiz_choice_translations)
        THEN
          RAISE EXCEPTION 'Quiz tables are not empty; migration aborted.';
        END IF;
      END
      $$
    `,
    ...buildInsertQueries(transaction, snapshot),
  ];
}

function parseArgs(args) {
  if (args.length === 0) return { apply: false };
  if (args.length === 1 && args[0] === "--apply") return { apply: true };
  throw new Error(`Unknown or duplicate option: ${args.join(" ")}`);
}

export { parseArgs as parseMigrationArgs };

async function applySnapshot(sql, snapshot) {
  await sql.transaction((transaction) => buildApplyQueries(transaction, snapshot), {
    isolationLevel: "ReadCommitted",
  });
}

/**
 * Quiz Data MigrationのPreflightまたはApplyを実行します。
 * @param {{apply?: boolean, sql?: Function, data?: object}} options 実行オプション。
 * @returns {Promise<{status: string, questionCount: number, choiceCount: number}>} 実行結果。
 */
export async function migrateQuizData({ apply = false, sql, data } = {}) {
  if (!process.env.DATABASE_URL && !sql) throw new Error("DATABASE_URL is required.");
  sql ??= neon(process.env.DATABASE_URL);
  const source = data ?? (await loadQuizSource());
  const parsed = parseQuizData(source);
  const relatedContent = await resolveRelatedContent(sql, parsed);
  const expected = buildExpectedSnapshot(parsed, relatedContent);
  const current = await readQuizSnapshot(sql);
  const state = classifyQuizState(current, expected);
  if (state === "inconsistent") {
    throw new Error("Quiz tables are not empty and do not match the migration source. Migration aborted.");
  }
  if (state === "already_migrated") {
    return {
      status: "already_migrated",
      questionCount: expected.rowCounts.questions,
      choiceCount: expected.rowCounts.choices,
    };
  }
  if (!apply)
    return {
      status: "dry_run_ready",
      questionCount: expected.rowCounts.questions,
      choiceCount: expected.rowCounts.choices,
    };
  await applySnapshot(sql, expected);
  const migrated = await readQuizSnapshot(sql);
  if (!snapshotsEqual(migrated, expected)) throw new Error("Post-migration Quiz snapshot does not match the source.");
  return { status: "applied", questionCount: expected.rowCounts.questions, choiceCount: expected.rowCounts.choices };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const result = await migrateQuizData({ apply, sql: neon(process.env.DATABASE_URL) });
  if (result.status === "dry_run_ready") {
    console.log(
      `Quiz data migration is ready: ${result.questionCount} questions, ${result.choiceCount} choices. No data was written.`,
    );
  } else if (result.status === "already_migrated") {
    console.log(
      `Quiz data is already migrated: ${result.questionCount} questions, ${result.choiceCount} choices. No data was written.`,
    );
  } else {
    console.log(
      `Quiz data migration applied and verified: ${result.questionCount} questions, ${result.choiceCount} choices.`,
    );
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Quiz data migration failed.");
    process.exitCode = 1;
  });
}
