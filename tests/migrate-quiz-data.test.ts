import { describe, expect, it } from "vitest";
import sourceData from "../apps/web/data/ireland/quiz.json";
import {
  buildExpectedSnapshot,
  buildInsertQueries,
  classifyQuizState,
  migrateQuizData,
  parseMigrationArgs,
  parseQuizData,
  resolveRelatedContent,
  snapshotsEqual,
} from "../scripts/migrate-quiz-data.mjs";

const relatedContentId = "550e8400-e29b-41d4-a716-446655440001";

function sourceCopy() {
  return structuredClone(sourceData) as Record<string, any>;
}

function parsedSource() {
  return parseQuizData(sourceCopy());
}

describe("quiz data migration validation", () => {
  it("validates the checked-in source and preserves all source IDs and counts", () => {
    const data = parsedSource();
    expect(data.questions).toHaveLength(9);
    expect(data.questions.reduce((count, question) => count + question.choices.length, 0)).toBe(36);
    expect(data.questions.map((question) => question.id)).toContain("irish-sports-gaelic-games-001");
    expect(data.questions.flatMap((question) => (question.relatedGuide ? [question.relatedGuide.slug] : []))).toEqual([
      "split-the-g",
    ]);
  });

  it.each([
    ["unsupported category", (source: any) => (source.questions[0].category = "unknown")],
    ["duplicate question ID", (source: any) => (source.questions[1].id = source.questions[0].id)],
    ["duplicate choice ID", (source: any) => (source.questions[0].choices[1].id = source.questions[0].choices[0].id)],
    ["wrong choice count", (source: any) => (source.questions[0].choices = source.questions[0].choices.slice(0, 3))],
    ["missing correct answer", (source: any) => (source.questions[0].answer = "missing")],
    ["invalid special date", (source: any) => (source.questions[0].specialDate = { month: 2, day: 30 })],
    ["non-HTTPS source", (source: any) => (source.questions[0].source.url = "http://example.com")],
    [
      "invalid related guide slug",
      (source: any) =>
        (source.questions[0].relatedGuide = { slug: "Not A Slug", label: { ja: "関連", en: "Related" } }),
    ],
  ])("rejects %s without correcting the input", (_name, mutate) => {
    const source = sourceCopy();
    mutate(source);
    expect(() => parseQuizData(source)).toThrow("Invalid quiz data");
  });

  it("rejects unknown CLI options and supports dry run/apply modes", () => {
    expect(parseMigrationArgs([])).toEqual({ apply: false });
    expect(parseMigrationArgs(["--apply"])).toEqual({ apply: true });
    expect(() => parseMigrationArgs(["--force"])).toThrow("Unknown or duplicate option");
    expect(() => parseMigrationArgs(["--apply", "--apply"])).toThrow("Unknown or duplicate option");
  });
});

describe("quiz data migration mapping", () => {
  it("maps source IDs, translations, publication, dates, and related content", () => {
    const expected = buildExpectedSnapshot(parsedSource(), new Map([["split-the-g", relatedContentId]]));
    const first = expected.questions.find((question: any) => question.id === "irish-sports-gaelic-games-001");
    expect(first).toMatchObject({
      id: "irish-sports-gaelic-games-001",
      correct_choice_id: expect.any(String),
      is_published: true,
    });
    expect(first.choices.map((choice: any) => choice.sort_order)).toEqual([0, 1, 2, 3]);
    expect(expected.questions.find((question: any) => question.related_content_id === relatedContentId)).toBeDefined();
    expect(first.translations).toHaveLength(2);
    expect(first.choices[0].translations).toHaveLength(2);
  });

  it("uses the Import path for UPSERT and never adds destructive or conflict-update SQL", () => {
    const expected = buildExpectedSnapshot(parsedSource(), new Map([["split-the-g", relatedContentId]]));
    const queries: Array<{ text: string; values: unknown[] }> = [];
    const transaction = (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push({ text: strings.join("?"), values });
      return Promise.resolve();
    };
    buildInsertQueries(transaction, expected);
    expect(queries).toHaveLength(135);
    expect(queries.every((query) => query.text.includes("INSERT INTO"))).toBe(true);
    expect(queries.join("\n")).not.toMatch(/ON CONFLICT|DELETE|TRUNCATE/u);
    expect(
      queries.some((query) => query.values.includes("irish-sports-gaelic-games-001") && query.values.includes(true)),
    ).toBe(true);
  });
});

function rowsFromSnapshot(snapshot: any) {
  return {
    questions: snapshot.questions.map(({ translations, choices, ...question }: any) => question),
    questionTranslations: snapshot.questions.flatMap((question: any) =>
      question.translations.map((translation: any) => ({ question_id: question.id, ...translation })),
    ),
    choices: snapshot.questions.flatMap((question: any) =>
      question.choices.map(({ translations, ...choice }: any) => ({ question_id: question.id, ...choice })),
    ),
    choiceTranslations: snapshot.questions.flatMap((question: any) =>
      question.choices.flatMap((choice: any) =>
        choice.translations.map((translation: any) => ({
          question_id: question.id,
          choice_id: choice.id,
          ...translation,
        })),
      ),
    ),
  };
}

function migrationSql(snapshot: any, options: { transactionError?: boolean; postMatch?: boolean } = {}) {
  const rows = rowsFromSnapshot(snapshot);
  let applied = false;
  let transactionCount = 0;
  const transactionQueries: string[] = [];
  const sql = ((strings: TemplateStringsArray) => {
    const query = strings.join("?");
    if (query.includes("FROM content_entries")) return Promise.resolve([{ id: relatedContentId }]);
    if (query.includes("FROM quiz_questions"))
      return Promise.resolve(applied && options.postMatch !== false ? rows.questions : []);
    if (query.includes("FROM quiz_question_translations"))
      return Promise.resolve(applied && options.postMatch !== false ? rows.questionTranslations : []);
    if (query.includes("FROM quiz_choices"))
      return Promise.resolve(applied && options.postMatch !== false ? rows.choices : []);
    if (query.includes("FROM quiz_choice_translations"))
      return Promise.resolve(applied && options.postMatch !== false ? rows.choiceTranslations : []);
    throw new Error(`Unexpected migration query: ${query}`);
  }) as any;
  sql.transaction = async (callback: (transaction: Function) => Promise<unknown>[]) => {
    transactionCount += 1;
    if (options.transactionError) throw new Error("transaction failed");
    const transaction = (strings: TemplateStringsArray) => {
      transactionQueries.push(strings.join("?"));
      return Promise.resolve();
    };
    await Promise.all(callback(transaction));
    applied = true;
  };
  return {
    sql,
    transactionQueries,
    get transactionCount() {
      return transactionCount;
    },
  };
}

describe("quiz data migration apply", () => {
  const expected = buildExpectedSnapshot(parsedSource(), new Map([["split-the-g", relatedContentId]]));

  it("checks the empty state and inserts atomically, then verifies the snapshot", async () => {
    const fake = migrationSql(expected);
    await expect(migrateQuizData({ apply: true, sql: fake.sql, data: sourceCopy() })).resolves.toMatchObject({
      status: "applied",
      questionCount: 9,
      choiceCount: 36,
    });
    expect(fake.transactionCount).toBe(1);
    expect(fake.transactionQueries[0]).toContain("LOCK TABLE");
    expect(fake.transactionQueries[1]).toContain("RAISE EXCEPTION");
    expect(fake.transactionQueries.filter((query) => query.includes("INSERT INTO"))).toHaveLength(135);
  });

  it("does not report success when the transaction fails", async () => {
    const fake = migrationSql(expected, { transactionError: true });
    await expect(migrateQuizData({ apply: true, sql: fake.sql, data: sourceCopy() })).rejects.toThrow(
      "transaction failed",
    );
    expect(fake.transactionCount).toBe(1);
  });

  it("rejects when post-migration snapshot validation fails", async () => {
    const fake = migrationSql(expected, { postMatch: false });
    await expect(migrateQuizData({ apply: true, sql: fake.sql, data: sourceCopy() })).rejects.toThrow(
      "Post-migration Quiz snapshot does not match the source.",
    );
    expect(fake.transactionCount).toBe(1);
  });
});

describe("quiz data migration state", () => {
  it("classifies empty, already migrated, and unsafe partial states", () => {
    const expected = buildExpectedSnapshot(parsedSource(), new Map([["split-the-g", relatedContentId]]));
    const empty = {
      questions: [],
      rowCounts: { questions: 0, questionTranslations: 0, choices: 0, choiceTranslations: 0 },
    };
    expect(classifyQuizState(empty, expected)).toBe("empty");
    expect(classifyQuizState(expected, expected)).toBe("already_migrated");
    const inconsistent = structuredClone(expected);
    inconsistent.questions[0].category = "changed";
    expect(snapshotsEqual(inconsistent, expected)).toBe(false);
    expect(classifyQuizState(inconsistent, expected)).toBe("inconsistent");
  });

  it("requires every related guide to resolve to one published bilingual guide", async () => {
    const data = parsedSource();
    const sql = (strings: TemplateStringsArray) => {
      expect(strings.join("?")).toContain("entry.status = 'published'");
      return Promise.resolve([]);
    };
    await expect(resolveRelatedContent(sql, data)).rejects.toThrow("Related Guide cannot be resolved: split-the-g");
  });

  it("supports a database-backed dry run without writing", async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://test-only";
    const queries: string[] = [];
    const sql = (strings: TemplateStringsArray) => {
      queries.push(strings.join("?"));
      if (strings.join("?").includes("FROM content_entries")) return Promise.resolve([{ id: relatedContentId }]);
      return Promise.resolve([]);
    };
    await expect(migrateQuizData({ sql, data: parsedSource() })).resolves.toMatchObject({ status: "dry_run_ready" });
    expect(queries.some((query) => query.includes("INSERT INTO"))).toBe(false);
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  });
});
