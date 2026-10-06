import { beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  getRequestLocale: vi.fn(),
  gradePublishedQuizAnswer: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: actionMocks.getRequestLocale }));
vi.mock("../../apps/web/app/lib/quiz/repository", () => ({
  gradePublishedQuizAnswer: actionMocks.gradePublishedQuizAnswer,
}));

import { submitQuizAnswer } from "../../apps/web/app/(content)/discover/quiz/actions";
const questionId = "11111111-1111-4111-8111-000000000007";

const result = {
  status: "correct",
  correctChoiceId: "correct",
  correctChoiceLabel: "Correct",
  explanation: "Explanation",
  source: { label: "Official source", url: "https://example.com/source" },
  relatedGuide: { slug: "split-the-g", label: "Learn more" },
} as const;

beforeEach(() => {
  actionMocks.getRequestLocale.mockReset().mockResolvedValue("en");
  actionMocks.gradePublishedQuizAnswer.mockReset().mockResolvedValue(result);
});

describe("submitQuizAnswer", () => {
  it("Server側でLocaleを決定し、Published Quiz Repositoryの結果を返す", async () => {
    await expect(submitQuizAnswer(questionId, "correct")).resolves.toBe(result);
    expect(actionMocks.gradePublishedQuizAnswer).toHaveBeenCalledWith(questionId, "correct", "en");
  });

  it("Repositoryの採点結果をそのまま返し、追加のContent取得を行わない", async () => {
    const resultWithoutGuide = { ...result, relatedGuide: undefined };
    actionMocks.gradePublishedQuizAnswer.mockResolvedValue(resultWithoutGuide);

    await expect(submitQuizAnswer(questionId, "correct")).resolves.toBe(resultWithoutGuide);
  });

  it("文字列ではない入力を採点前に拒否する", async () => {
    await expect(submitQuizAnswer(null as unknown as string, "correct")).rejects.toThrow(
      "Question and choice IDs are required",
    );
    expect(actionMocks.getRequestLocale).not.toHaveBeenCalled();
    expect(actionMocks.gradePublishedQuizAnswer).not.toHaveBeenCalled();
  });

  it.each([
    ["legacy Question ID", "legacy-question", "correct"],
    ["invalid UUID", "INVALID_ID", "correct"],
    ["Choice ID", questionId, "INVALID_ID"],
  ])("%sの形式を採点前に検証する", async (_label, invalidQuestionId, choiceId) => {
    await expect(submitQuizAnswer(invalidQuestionId, choiceId)).rejects.toThrow("Invalid quiz answer");
    expect(actionMocks.getRequestLocale).not.toHaveBeenCalled();
    expect(actionMocks.gradePublishedQuizAnswer).not.toHaveBeenCalled();
  });
});
