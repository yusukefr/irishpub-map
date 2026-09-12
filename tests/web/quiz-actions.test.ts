import { beforeEach, describe, expect, it, vi } from "vitest";

const actionMocks = vi.hoisted(() => ({
  getPublishedContentBySlug: vi.fn(),
  getRequestLocale: vi.fn(),
  gradeQuizAnswer: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/content/repository", () => ({
  getPublishedContentBySlug: actionMocks.getPublishedContentBySlug,
}));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: actionMocks.getRequestLocale }));
vi.mock("../../apps/web/app/lib/quiz/queries", () => ({ gradeQuizAnswer: actionMocks.gradeQuizAnswer }));

import { submitQuizAnswer } from "../../apps/web/app/(content)/discover/quiz/actions";

const result = {
  status: "correct",
  correctChoiceId: "correct",
  correctChoiceLabel: "Correct",
  explanation: "Explanation",
  source: { label: "Official source", url: "https://example.com/source" },
  relatedGuide: { slug: "split-the-g", label: "Learn more" },
} as const;

beforeEach(() => {
  actionMocks.getPublishedContentBySlug.mockReset();
  actionMocks.getRequestLocale.mockReset().mockResolvedValue("en");
  actionMocks.gradeQuizAnswer.mockReset().mockReturnValue(result);
});

describe("submitQuizAnswer", () => {
  it("公開Guideが存在する場合は関連Guideを返す", async () => {
    actionMocks.getPublishedContentBySlug.mockResolvedValue({ slug: "split-the-g" });

    await expect(submitQuizAnswer("question", "correct")).resolves.toBe(result);
    expect(actionMocks.gradeQuizAnswer).toHaveBeenCalledWith("question", "correct", "en");
    expect(actionMocks.getPublishedContentBySlug).toHaveBeenCalledWith("guide", "split-the-g", "en");
  });

  it("公開Guideを取得できない場合は関連Guideだけを除外する", async () => {
    actionMocks.getPublishedContentBySlug.mockResolvedValue(null);

    await expect(submitQuizAnswer("question", "correct")).resolves.toEqual({
      ...result,
      relatedGuide: undefined,
    });
  });

  it("公開Guideの取得が失敗した場合も採点結果を返す", async () => {
    actionMocks.getPublishedContentBySlug.mockRejectedValue(new Error("database unavailable"));

    await expect(submitQuizAnswer("question", "correct")).resolves.toEqual({
      ...result,
      relatedGuide: undefined,
    });
  });

  it("関連Guideがない場合は公開Content Repositoryへ問い合わせない", async () => {
    const { relatedGuide: _relatedGuide, ...resultWithoutGuide } = result;
    actionMocks.gradeQuizAnswer.mockReturnValue(resultWithoutGuide);

    await expect(submitQuizAnswer("question", "correct")).resolves.toBe(resultWithoutGuide);
    expect(actionMocks.getPublishedContentBySlug).not.toHaveBeenCalled();
  });

  it("文字列ではない入力を採点前に拒否する", async () => {
    await expect(submitQuizAnswer(null as unknown as string, "correct")).rejects.toThrow(
      "Question and choice IDs are required",
    );
    expect(actionMocks.getRequestLocale).not.toHaveBeenCalled();
    expect(actionMocks.gradeQuizAnswer).not.toHaveBeenCalled();
  });
});
