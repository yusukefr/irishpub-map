import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminQuizQuestion } from "../../apps/web/app/lib/quiz/types";
const mocks = vi.hoisted(() => ({
  getAdminContent: vi.fn(),
  getAdminQuizQuestion: vi.fn(),
  insertAdminQuizQuestion: vi.fn(),
  listAdminQuizQuestions: vi.fn(),
  replaceAdminQuizQuestion: vi.fn(),
  setAdminQuizPublication: vi.fn(),
  getMediaAsset: vi.fn(),
}));
vi.mock("../../apps/web/app/lib/admin-content-repository", () => ({ getAdminContent: mocks.getAdminContent }));
vi.mock("../../apps/web/app/lib/media/repository", () => ({ getMediaAsset: mocks.getMediaAsset }));
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
const imageAssetId = "550e8400-e29b-41d4-a716-446655440009";
const question: AdminQuizQuestion = {
  id: "history-question-001",
  category: "history",
  specialDate: { month: 2, day: 29 },
  correctChoiceId: "choice-1",
  sourceUrl: "https://example.com/source",
  relatedContentId: guideId,
  imageAssetId: null,
  image: null,
  isPublished: false,
  translations: {
    ja: { question: "問題", explanation: "解説", sourceLabel: "出典", imageAlt: "", imageCaption: "" },
    en: { question: "Question", explanation: "Explanation", sourceLabel: "Source", imageAlt: "", imageCaption: "" },
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
  imageAssetId: null,
  translations: {
    ja: { question: " 問題 ", explanation: " 解説 ", sourceLabel: " 出典 ", imageAlt: "", imageCaption: "" },
    en: {
      question: " Question ",
      explanation: " Explanation ",
      sourceLabel: " Source ",
      imageAlt: "",
      imageCaption: "",
    },
  },
  choices: [1, 2, 3, 4].map((number) => ({
    id: "choice-" + number,
    translations: { ja: "選択肢" + number, en: "Choice " + number },
  })),
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminContent.mockResolvedValue({ kind: "guide" });
  mocks.getMediaAsset.mockResolvedValue({ id: imageAssetId, mimeType: "image/jpeg" });
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
        translations: expect.objectContaining({
          ja: { question: "問題", explanation: "解説", sourceLabel: "出典", imageAlt: "", imageCaption: "" },
        }),
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
        ja: { question: "", explanation: "", sourceLabel: "", imageAlt: "", imageCaption: "" },
        en: { question: "", explanation: "", sourceLabel: "", imageAlt: "", imageCaption: "" },
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
          ja: { question: "", explanation: "", sourceLabel: "", imageAlt: "", imageCaption: "" },
          en: { question: "", explanation: "", sourceLabel: "", imageAlt: "", imageCaption: "" },
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
  it("画像IDの存在を検証し、Draftではaltなしを許可して画像解除時は説明を消す", async () => {
    await createAdminQuiz({ ...payload, imageAssetId });
    expect(mocks.getMediaAsset).toHaveBeenCalledWith(imageAssetId);
    expect(mocks.insertAdminQuizQuestion).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ imageAssetId }),
    );

    mocks.insertAdminQuizQuestion.mockClear();
    await createAdminQuiz({
      ...payload,
      imageAssetId: null,
      translations: {
        ja: { ...payload.translations.ja, imageAlt: "古い説明", imageCaption: "古いキャプション" },
        en: { ...payload.translations.en, imageAlt: "Old alt", imageCaption: "Old caption" },
      },
    });
    expect(mocks.insertAdminQuizQuestion).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        imageAssetId: null,
        translations: expect.objectContaining({
          ja: expect.objectContaining({ imageAlt: "", imageCaption: "" }),
          en: expect.objectContaining({ imageAlt: "", imageCaption: "" }),
        }),
      }),
    );
  });

  it("不正または存在しない画像IDと長すぎるalt/captionを拒否する", async () => {
    await expect(createAdminQuiz({ ...payload, imageAssetId: "not-a-uuid" })).rejects.toMatchObject({
      code: "validation",
      fieldErrors: { imageAssetId: "invalid_format" },
    });
    mocks.getMediaAsset.mockResolvedValueOnce(null);
    await expect(createAdminQuiz({ ...payload, imageAssetId })).rejects.toMatchObject({
      code: "validation",
      fieldErrors: { imageAssetId: "invalid_format" },
    });
    await expect(
      createAdminQuiz({
        ...payload,
        imageAssetId,
        translations: {
          ...payload.translations,
          ja: { ...payload.translations.ja, imageAlt: "a".repeat(501), imageCaption: "b".repeat(1001) },
        },
      }),
    ).rejects.toMatchObject({
      code: "validation",
      fieldErrors: { "translations.ja.imageAlt": "too_long", "translations.ja.imageCaption": "too_long" },
    });
  });

  it("画像ありの公開には日英altを要求し、captionは任意にする", () => {
    const withImage = { ...question, imageAssetId };
    expect(getQuizPublicationMissingFields(withImage)).toEqual(
      expect.arrayContaining(["translations.ja.imageAlt", "translations.en.imageAlt"]),
    );
    expect(
      getQuizPublicationMissingFields({
        ...withImage,
        translations: {
          ja: { ...question.translations.ja, imageAlt: "建物の外観" },
          en: { ...question.translations.en, imageAlt: "Exterior of a building" },
        },
      }),
    ).toEqual([]);
  });
  it("maps duplicate Question IDs to a conflict", async () => {
    mocks.insertAdminQuizQuestion.mockRejectedValue({ code: "23505" });
    await expect(createAdminQuiz(payload)).rejects.toMatchObject({
      code: "conflict",
      fieldErrors: { id: "invalid_format" },
    });
  });
  it("keeps legacy Question IDs readable during the UUID migration", async () => {
    await expect(updateAdminQuiz("legacy-question", payload)).resolves.toEqual(question);
    expect(mocks.replaceAdminQuizQuestion).toHaveBeenCalledWith("legacy-question", expect.anything());
  });
  it("reports invalid publication state without blaming the Question ID", async () => {
    await expect(changeAdminQuizPublication(question.id, "true" as boolean)).rejects.toMatchObject({
      code: "validation",
      fieldErrors: {},
    });
    expect(mocks.setAdminQuizPublication).not.toHaveBeenCalled();
  });
});
