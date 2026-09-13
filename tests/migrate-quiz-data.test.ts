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
