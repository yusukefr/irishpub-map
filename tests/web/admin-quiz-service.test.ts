import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminQuizQuestion } from "../../apps/web/app/lib/quiz/types";
const mocks = vi.hoisted(() => ({
  getAdminContent: vi.fn(),
  getAdminQuizQuestion: vi.fn(),
  insertAdminQuizQuestion: vi.fn(),
  listAdminQuizQuestions: vi.fn(),
  replaceAdminQuizQuestion: vi.fn(),
  setAdminQuizPublication: vi.fn(),
}));
vi.mock("../../apps/web/app/lib/admin-content-repository", () => ({ getAdminContent: mocks.getAdminContent }));
vi.mock("../../apps/web/app/lib/quiz/repository", () => ({
  getAdminQuizQuestion: mocks.getAdminQuizQuestion,
  insertAdminQuizQuestion: mocks.insertAdminQuizQuestion,
  listAdminQuizQuestions: mocks.listAdminQuizQuestions,
  replaceAdminQuizQuestion: mocks.replaceAdminQuizQuestion,
  setAdminQuizPublication: mocks.setAdminQuizPublication,
}));
import {
  changeAdminQuizPublication,
  createAdminQuiz,
  getQuizPublicationMissingFields,
  updateAdminQuiz,
} from "../../apps/web/app/lib/admin-quiz-service";
const guideId = "550e8400-e29b-41d4-a716-446655440001";
const question: AdminQuizQuestion = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  category: "history",
  specialDate: { month: 2, day: 29 },
  correctChoiceId: "choice-1",
  sourceUrl: "https://example.com/source",
  relatedContentId: guideId,
  isPublished: false,
  translations: {
    ja: { question: "問題", explanation: "解説", sourceLabel: "出典" },
    en: { question: "Question", explanation: "Explanation", sourceLabel: "Source" },
  },
  choices: [1, 2, 3, 4].map((number, sortOrder) => ({
    id: "choice-" + number,
    sortOrder,
    translations: { ja: "選択肢" + number, en: "Choice " + number },
  })),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const payload = {
  category: "history",
  specialDate: { month: 2, day: 29 },
  correctChoiceId: "choice-1",
  sourceUrl: "https://example.com/source",
  relatedContentId: guideId,
  translations: {
    ja: { question: " 問題 ", explanation: " 解説 ", sourceLabel: " 出典 " },
    en: { question: " Question ", explanation: " Explanation ", sourceLabel: " Source " },
  },
  choices: [1, 2, 3, 4].map((number) => ({
    id: "choice-" + number,
    translations: { ja: "選択肢" + number, en: "Choice " + number },
  })),
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminContent.mockResolvedValue({ kind: "guide" });
  mocks.getAdminQuizQuestion.mockResolvedValue(question);
  mocks.insertAdminQuizQuestion.mockResolvedValue(undefined);
  mocks.replaceAdminQuizQuestion.mockResolvedValue("updated");
  mocks.setAdminQuizPublication.mockResolvedValue({ id: question.id, isPublished: true, unchanged: false });
});
describe("admin quiz service", () => {
  it("normalizes valid draft input and generates sort order from array order", async () => {
    await expect(createAdminQuiz({ ...payload, id: "legacy-question" })).resolves.toEqual(question);
    expect(mocks.insertAdminQuizQuestion).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]{36}$/iu),
      expect.objectContaining({
        choices: expect.arrayContaining([expect.objectContaining({ id: "choice-1", sortOrder: 0 })]),
        translations: expect.objectContaining({ ja: { question: "問題", explanation: "解説", sourceLabel: "出典" } }),
      }),
    );
  });
  it.each([
    { category: "not-a-category" },
    { specialDate: { month: 2, day: 30 } },
    { sourceUrl: "http://example.com" },
    { correctChoiceId: "other-choice" },
  ])("rejects invalid write input: %o", async (change) => {
    await expect(createAdminQuiz({ ...payload, ...change })).rejects.toMatchObject({ code: "validation" });
    expect(mocks.insertAdminQuizQuestion).not.toHaveBeenCalled();
  });
  it("rejects a related story or missing guide", async () => {
    mocks.getAdminContent.mockResolvedValue({ kind: "story" });
    await expect(createAdminQuiz(payload)).rejects.toMatchObject({
      code: "validation",
      fieldErrors: { relatedContentId: "invalid_format" },
    });
    mocks.getAdminContent.mockResolvedValue(null);
    await expect(createAdminQuiz(payload)).rejects.toMatchObject({ code: "validation" });
  });
  it("allows incomplete drafts but returns publication requirements", async () => {
    const draft = { choices: [] };
    mocks.getAdminQuizQuestion.mockResolvedValue({
      ...question,
      ...draft,
      category: null,
      correctChoiceId: null,
      sourceUrl: null,
      isPublished: false,
      translations: {
        ja: { question: "", explanation: "", sourceLabel: "" },
        en: { question: "", explanation: "", sourceLabel: "" },
      },
    });
    await expect(createAdminQuiz(draft)).resolves.toBeTruthy();
    expect(
      getQuizPublicationMissingFields({
        ...question,
        ...draft,
        category: null,
        correctChoiceId: null,
        sourceUrl: null,
        translations: {
          ja: { question: "", explanation: "", sourceLabel: "" },
          en: { question: "", explanation: "", sourceLabel: "" },
        },
      }),
    ).toEqual(expect.arrayContaining(["category", "choices", "correctChoiceId", "sourceUrl"]));
  });
  it("blocks incomplete updates for a published question and supports unpublish", async () => {
    mocks.replaceAdminQuizQuestion.mockResolvedValue("publication_blocked");
    await expect(updateAdminQuiz(question.id, { ...payload, category: null })).rejects.toMatchObject({
      code: "publication_requirements_not_met",
    });
    await expect(changeAdminQuizPublication(question.id, false)).resolves.toMatchObject({ isPublished: true });
    expect(mocks.setAdminQuizPublication).toHaveBeenCalledWith(question.id, false);
  });
  it("rejects non-UUID Question IDs for updates", async () => {
    await expect(updateAdminQuiz("legacy-question", payload)).rejects.toMatchObject({
      code: "validation",
      fieldErrors: { id: "invalid_format" },
    });
    expect(mocks.replaceAdminQuizQuestion).not.toHaveBeenCalled();
  });
});
