import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminQuizWriteInput } from "../../apps/web/app/lib/quiz/types";

const mocks = vi.hoisted(() => ({
  queries: [] as Array<{ text: string; values: unknown[] }>,
  responses: [] as Array<Array<Record<string, unknown>>>,
  transactionCount: 0,
  getPublishedContentById: vi.fn(),
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const query = (strings: TemplateStringsArray, ...values: unknown[]) => {
      mocks.queries.push({ text: strings.join("?"), values });
      return Promise.resolve(mocks.responses.shift() ?? []);
    };
    query.transaction = async (callback: (transaction: typeof query) => Array<Promise<unknown>>) => {
      mocks.transactionCount += 1;
      return Promise.all(callback(query));
    };
    return query;
  },
}));
const cacheMocks = vi.hoisted(() => ({ unstableCache: vi.fn(), revalidateTag: vi.fn() }));
cacheMocks.unstableCache.mockImplementation((query: () => Promise<unknown>) => query);
vi.mock("next/cache", () => ({
  unstable_cache: cacheMocks.unstableCache,
  revalidateTag: cacheMocks.revalidateTag,
}));
vi.mock("../../apps/web/app/lib/content/repository", () => ({
  getPublishedContentById: mocks.getPublishedContentById,
}));

import {
  getAdminQuizQuestion,
  getDailyPublishedQuiz,
  gradePublishedQuizAnswer,
  insertAdminQuizQuestion,
  listAdminQuizQuestions,
  listPublishedQuizQuestions,
  parsePublishedQuizRows,
  replaceAdminQuizQuestion,
  setAdminQuizPublication,
} from "../../apps/web/app/lib/quiz/repository";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalE2ETestMode = process.env.E2E_TEST_MODE;
const relatedContentId = "550e8400-e29b-41d4-a716-446655440001";

function publicRows(
  id = "550e8400-e29b-41d4-a716-446655440010",
  specialMonth: number | null = null,
  specialDay: number | null = null,
) {
  return [2, 0, 3, 1].map((sortOrder) => ({
    id,
    category: "history",
    special_month: specialMonth,
    special_day: specialDay,
    question: `Question ${id}`,
    choice_id: `choice-${sortOrder}`,
    sort_order: sortOrder,
    choice_label: `Choice ${sortOrder}`,
  }));
}

function adminBase(isPublished = false) {
  return {
    id: "550e8400-e29b-41d4-a716-446655440010",
    category: isPublished ? "history" : null,
    special_month: null,
    special_day: null,
    correct_choice_id: isPublished ? "choice-0" : null,
    source_url: isPublished ? "https://example.com/source" : null,
    related_content_id: null,
    is_published: isPublished,
    created_at: "2026-09-12T00:00:00.000Z",
    updated_at: "2026-09-12T01:00:00.000Z",
  };
}

function adminDetailRows(isPublished = false) {
  return [2, 0, 3, 1].map((sortOrder) => ({
    ...adminBase(isPublished),
    question_ja: isPublished ? "問題" : "下書き",
    explanation_ja: isPublished ? "解説" : "",
    source_label_ja: isPublished ? "出典" : "",
    question_en: isPublished ? "Question" : "",
    explanation_en: isPublished ? "Explanation" : "",
    source_label_en: isPublished ? "Source" : "",
    choice_id: `choice-${sortOrder}`,
    sort_order: sortOrder,
    choice_label_ja: isPublished ? `選択肢${sortOrder}` : "",
    choice_label_en: isPublished ? `Choice ${sortOrder}` : "",
  }));
}

const writeInput: AdminQuizWriteInput = {
  category: "history",
  specialDate: { month: 3, day: 17 },
  correctChoiceId: "choice-0",
  sourceUrl: "https://example.com/source",
  relatedContentId,
  translations: {
    ja: { question: "問題", explanation: "解説", sourceLabel: "出典" },
    en: { question: "Question", explanation: "Explanation", sourceLabel: "Source" },
  },
  choices: [0, 1, 2, 3].map((sortOrder) => ({
    id: `choice-${sortOrder}`,
    sortOrder,
    translations: { ja: `選択肢${sortOrder}`, en: `Choice ${sortOrder}` },
  })),
};

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test-only";
  delete process.env.E2E_TEST_MODE;
  mocks.queries = [];
  mocks.responses = [];
  mocks.transactionCount = 0;
  mocks.getPublishedContentById.mockReset();
  cacheMocks.revalidateTag.mockReset();
});

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalE2ETestMode === undefined) delete process.env.E2E_TEST_MODE;
  else process.env.E2E_TEST_MODE = originalE2ETestMode;
});

describe("public quiz repository", () => {
  it("E2E Test ModeではPublished Question一覧と採点をfixtureから返す", async () => {
    process.env.E2E_TEST_MODE = "1";
    delete process.env.DATABASE_URL;

    const questions = await listPublishedQuizQuestions("en");
    expect(questions).toHaveLength(1);
    expect(questions[0]).not.toHaveProperty("correctChoiceId");
    await expect(gradePublishedQuizAnswer(questions[0].id, questions[0].choices[0].id, "en")).resolves.toMatchObject({
      status: "correct",
      explanation: "An explanation for E2E.",
      relatedGuide: { slug: "e2e-published-guide" },
    });
  });
  it("公開済みだけをLocale fallback付きで取得し、回答情報をSQLとDTOへ含めない", async () => {
    mocks.responses = [publicRows()];

    await expect(listPublishedQuizQuestions("en")).resolves.toEqual([
      {
        id: "550e8400-e29b-41d4-a716-446655440010",
        category: "history",
        question: "Question 550e8400-e29b-41d4-a716-446655440010",
        choices: [0, 1, 2, 3].map((value) => ({ id: `choice-${value}`, label: `Choice ${value}` })),
      },
    ]);

    const query = mocks.queries[0];
    expect(query.text).toContain("question.is_published = TRUE");
    expect(query.text).toContain("locale_preference");
    expect(query.values).toEqual(expect.arrayContaining(["en", "ja"]));
    expect(query.text).not.toMatch(/correct_choice_id|explanation|source_url|related_content_id/u);
  });

  it("Asia/Tokyoの日付でSpecial Dateを優先し、同じ集合から決定的に選択する", async () => {
    const rows = [
      ...publicRows("550e8400-e29b-41d4-a716-446655440012"),
      ...publicRows("550e8400-e29b-41d4-a716-446655440013", 3, 17),
    ];
    mocks.responses = [rows, rows];

    const first = await getDailyPublishedQuiz("ja", new Date("2026-03-16T15:00:00Z"));
    const second = await getDailyPublishedQuiz("ja", new Date("2026-03-17T01:00:00Z"));

    expect(first?.id).toBe("550e8400-e29b-41d4-a716-446655440013");
    expect(second?.id).toBe(first?.id);
  });

  it("公開Questionを採点し、公開Guideだけを回答後に付加する", async () => {
    mocks.responses = [
      [
        {
          id: "550e8400-e29b-41d4-a716-446655440010",
          selected_choice_id: "choice-1",
          correct_choice_id: "choice-0",
          resolved_correct_choice_id: "choice-0",
          explanation: "Explanation",
          source_label: "Official source",
          source_url: "https://example.com/source",
          correct_choice_label: "Choice 0",
          related_content_id: relatedContentId,
        },
      ],
    ];
    mocks.getPublishedContentById.mockResolvedValue({ kind: "guide", slug: "irish-history", title: "Irish history" });

    await expect(gradePublishedQuizAnswer("550e8400-e29b-41d4-a716-446655440010", "choice-1", "en")).resolves.toEqual({
      status: "incorrect",
      correctChoiceId: "choice-0",
      correctChoiceLabel: "Choice 0",
      explanation: "Explanation",
      source: { label: "Official source", url: "https://example.com/source" },
      relatedGuide: { slug: "irish-history", label: "Irish history" },
    });
    expect(mocks.queries[0].text).toContain("question.is_published = TRUE");
    expect(mocks.queries[0].values).toEqual(
      expect.arrayContaining(["550e8400-e29b-41d4-a716-446655440010", "choice-1", "en", "ja"]),
    );
    expect(mocks.queries[0].text).not.toContain("550e8400-e29b-41d4-a716-446655440010");
    expect(mocks.getPublishedContentById).toHaveBeenCalledWith(relatedContentId, "en");
  });

  it("Draft、存在しないQuestion、存在しないChoiceを採点しない", async () => {
    mocks.responses = [
      [],
      [
        {
          id: "550e8400-e29b-41d4-a716-446655440010",
          selected_choice_id: null,
          correct_choice_id: "choice-0",
          resolved_correct_choice_id: "choice-0",
          explanation: "Explanation",
          source_label: "Source",
          source_url: "https://example.com/source",
          correct_choice_label: "Choice 0",
          related_content_id: null,
        },
      ],
    ];

    await expect(gradePublishedQuizAnswer("550e8400-e29b-41d4-a716-446655440014", "choice-0", "en")).rejects.toThrow(
      "question was not found",
    );
    await expect(gradePublishedQuizAnswer("550e8400-e29b-41d4-a716-446655440010", "missing", "en")).rejects.toThrow(
      "choice was not found",
    );
  });

  it("Published更新成功後だけPublic Quiz Cacheを失効させる", async () => {
    mocks.responses = [
      [{ id: "550e8400-e29b-41d4-a716-446655440010", is_published: true }],
      [{ id: "550e8400-e29b-41d4-a716-446655440010" }],
    ];

    await expect(replaceAdminQuizQuestion("550e8400-e29b-41d4-a716-446655440010", writeInput)).resolves.toBe("updated");
    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith("public-quiz", { expire: 0 });
  });

  it("Draft更新ではPublic Quiz Cacheを失効させない", async () => {
    mocks.responses = [
      [{ id: "550e8400-e29b-41d4-a716-446655440010", is_published: false }],
      [{ id: "550e8400-e29b-41d4-a716-446655440010" }],
    ];

    await expect(replaceAdminQuizQuestion("550e8400-e29b-41d4-a716-446655440010", writeInput)).resolves.toBe("updated");
    expect(cacheMocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("PublishとUnpublishの実際の状態変更後だけPublic Quiz Cacheを失効させる", async () => {
    mocks.responses = [
      [{ id: "550e8400-e29b-41d4-a716-446655440010", is_published: false }],
      [{ id: "550e8400-e29b-41d4-a716-446655440010", is_published: true }],
    ];
    await expect(setAdminQuizPublication("550e8400-e29b-41d4-a716-446655440010", true)).resolves.toMatchObject({
      unchanged: false,
    });
    expect(cacheMocks.revalidateTag).toHaveBeenCalledTimes(1);

    cacheMocks.revalidateTag.mockReset();
    mocks.responses = [
      [{ id: "550e8400-e29b-41d4-a716-446655440010", is_published: true }],
      [{ id: "550e8400-e29b-41d4-a716-446655440010", is_published: false }],
    ];
    await expect(setAdminQuizPublication("550e8400-e29b-41d4-a716-446655440010", false)).resolves.toMatchObject({
      unchanged: false,
    });
    expect(cacheMocks.revalidateTag).toHaveBeenCalledTimes(1);
  });

  it("Related Content取得失敗時も採点結果を返す", async () => {
    mocks.responses = [
      [
        {
          id: "550e8400-e29b-41d4-a716-446655440010",
          selected_choice_id: "choice-0",
          correct_choice_id: "choice-0",
          resolved_correct_choice_id: "choice-0",
          explanation: "解説",
          source_label: "出典",
          source_url: "https://example.com/source",
          correct_choice_label: "選択肢0",
          related_content_id: relatedContentId,
        },
      ],
    ];
    mocks.getPublishedContentById.mockRejectedValue(new Error("unavailable"));

    await expect(
      gradePublishedQuizAnswer("550e8400-e29b-41d4-a716-446655440010", "choice-0", "ja"),
    ).resolves.not.toHaveProperty("relatedGuide");
  });

  it("不正カテゴリや4件未満のChoiceをSilentに変換しない", () => {
    expect(() => parsePublishedQuizRows(publicRows().slice(0, 3))).toThrow("Invalid quiz data");
    expect(() => parsePublishedQuizRows(publicRows().map((row) => ({ ...row, category: "unknown" })))).toThrow(
      "Invalid quiz data",
    );
  });
});

describe("admin quiz repository", () => {
  it("E2E Test Modeでは全MutationをDB接続前に拒否する", async () => {
    process.env.E2E_TEST_MODE = "1";

    await expect(insertAdminQuizQuestion("550e8400-e29b-41d4-a716-446655440010", writeInput)).rejects.toThrow(
      "Mutations are disabled in E2E test mode.",
    );
    await expect(replaceAdminQuizQuestion("550e8400-e29b-41d4-a716-446655440010", writeInput)).rejects.toThrow(
      "Mutations are disabled in E2E test mode.",
    );
    await expect(setAdminQuizPublication("550e8400-e29b-41d4-a716-446655440010", true)).rejects.toThrow(
      "Mutations are disabled in E2E test mode.",
    );
    expect(mocks.transactionCount).toBe(0);
    expect(mocks.queries).toEqual([]);
  });

  it("DraftとPublishedを含む一覧を取得する", async () => {
    mocks.responses = [
      [
        { ...adminBase(false), question_ja: "下書き", question_en: "", choice_count: 0 },
        {
          ...adminBase(true),
          id: "550e8400-e29b-41d4-a716-446655440011",
          question_ja: "公開問題",
          question_en: "Published",
          choice_count: 4,
        },
      ],
    ];

    const result = await listAdminQuizQuestions();
    expect(result).toHaveLength(2);
    expect(result.map(({ isPublished }) => isPublished)).toEqual([false, true]);
    expect(mocks.queries[0].text).not.toContain("WHERE question.is_published");
  });

  it("入力途中のDraftとChoiceをsort_order順で取得する", async () => {
    mocks.responses = [adminDetailRows(false)];

    const result = await getAdminQuizQuestion("550e8400-e29b-41d4-a716-446655440010");
    expect(result).toMatchObject({
      id: "550e8400-e29b-41d4-a716-446655440010",
      category: null,
      correctChoiceId: null,
      sourceUrl: null,
      isPublished: false,
      translations: { ja: { question: "下書き" }, en: { question: "" } },
    });
    expect(result?.choices.map(({ sortOrder }) => sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it("Question・翻訳・Choiceをparameterizedな単一transactionで作成する", async () => {
    await insertAdminQuizQuestion("550e8400-e29b-41d4-a716-446655440010", writeInput);

    expect(mocks.transactionCount).toBe(1);
    expect(mocks.queries).toHaveLength(15);
    expect(mocks.queries.map(({ text }) => text).join("\n")).toContain("INSERT INTO quiz_questions");
    expect(mocks.queries.map(({ text }) => text).join("\n")).toContain("INSERT INTO quiz_choices");
    expect(mocks.queries[0].values).toContain("550e8400-e29b-41d4-a716-446655440010");
    expect(mocks.queries.map(({ text }) => text).join("\n")).not.toContain("https://example.com/source");
  });

  it("行ロック後にQuestionとChoice全体を更新する", async () => {
    mocks.responses = [
      [{ id: "550e8400-e29b-41d4-a716-446655440010", is_published: false }],
      [{ id: "550e8400-e29b-41d4-a716-446655440010" }],
    ];

    await expect(replaceAdminQuizQuestion("550e8400-e29b-41d4-a716-446655440010", writeInput)).resolves.toBe("updated");
    expect(mocks.transactionCount).toBe(1);
    expect(mocks.queries[0].text).toContain("FOR UPDATE");
    expect(mocks.queries.map(({ text }) => text).join("\n")).toContain("DELETE FROM quiz_choices");
  });

  it("公開中Questionの不完全な全体更新では全クエリを無変更にする", async () => {
    const incomplete = { ...writeInput, category: null, correctChoiceId: null, sourceUrl: null };
    mocks.responses = [[{ id: "550e8400-e29b-41d4-a716-446655440010", is_published: true }], []];

    await expect(replaceAdminQuizQuestion("550e8400-e29b-41d4-a716-446655440010", incomplete)).resolves.toBe(
      "publication_blocked",
    );
    const choiceTranslationSql = mocks.queries
      .filter(({ text }) => text.includes("INSERT INTO quiz_choice_translations"))
      .map(({ text }) => text)
      .join("\n");
    expect(choiceTranslationSql).toContain("question.is_published = FALSE OR");
  });

  it("公開時に日英翻訳・4 Choices・正解をtransaction内で再検証する", async () => {
    mocks.responses = [
      [{ id: "550e8400-e29b-41d4-a716-446655440010", is_published: false }],
      [{ id: "550e8400-e29b-41d4-a716-446655440010", is_published: true }],
    ];

    await expect(setAdminQuizPublication("550e8400-e29b-41d4-a716-446655440010", true)).resolves.toEqual({
      id: "550e8400-e29b-41d4-a716-446655440010",
      isPublished: true,
      unchanged: false,
    });
    const sql = mocks.queries[1].text;
    expect(sql).toContain("COUNT(*)");
    expect(sql).toContain("question.category = ANY");
    expect(sql).toContain("LOWER(question.source_url) LIKE 'https://%'");
    expect(sql).toContain("(VALUES ('ja'), ('en'))");
    expect(sql).toContain("btrim(translation.label)");
  });

  it("不完全なPublished行をSilentに返さない", async () => {
    mocks.responses = [adminDetailRows(true).slice(0, 3)];
    await expect(getAdminQuizQuestion("550e8400-e29b-41d4-a716-446655440010")).rejects.toThrow("Invalid quiz data");
  });

  it("DB未設定時は読み取りを空にし、静的JSONへfallbackしない", async () => {
    delete process.env.DATABASE_URL;
    await expect(listPublishedQuizQuestions()).resolves.toEqual([]);
    await expect(listAdminQuizQuestions()).resolves.toEqual([]);
    await expect(getAdminQuizQuestion("550e8400-e29b-41d4-a716-446655440010")).resolves.toBeNull();
    await expect(insertAdminQuizQuestion("550e8400-e29b-41d4-a716-446655440010", writeInput)).rejects.toThrow(
      "Database is not configured",
    );
    expect(mocks.queries).toEqual([]);
  });
});
