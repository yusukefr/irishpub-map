import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizAnswerResult } from "../../apps/web/app/lib/quiz/types";

const actionMocks = vi.hoisted(() => ({ submitQuizAnswer: vi.fn() }));
vi.mock("../../apps/web/app/(content)/discover/quiz/actions", () => ({
  submitQuizAnswer: actionMocks.submitQuizAnswer,
}));

import { QuizCard, type QuizLabels, type QuizQuestionView } from "../../apps/web/app/(content)/discover/quiz/quiz-card";

const question = {
  id: "irish-sports-gaelic-games-001",
  category: { icon: "🏑", label: "アイルランドのスポーツ" },
  question: "次のうち、Gaelic Gamesに含まれる競技はどれですか？",
  choices: [
    { id: "cricket", label: "Cricket" },
    { id: "hurling", label: "Hurling" },
    { id: "rugby", label: "Rugby" },
    { id: "polo", label: "Polo" },
  ],
} satisfies QuizQuestionView;

const labels = {
  questionLabel: "今日の問題",
  chooseAnswer: "答えを1つ選んでください",
  submitAnswer: "回答する",
  submitting: "採点中…",
  answered: "回答済み",
  correct: "正解！ 🎉",
  incorrect: "残念！",
  correctAnswer: "正解",
  explanationHeading: "解説",
  source: "情報源",
  answerError: "回答を採点できませんでした。",
} satisfies QuizLabels;

const correctResult = {
  status: "correct",
  correctChoiceId: "hurling",
  correctChoiceLabel: "Hurling",
  explanation: "HurlingはGaelic Gamesを構成する競技のひとつです。",
  source: { label: "Gaelic Athletic Association", url: "https://www.gaa.ie/the-gaa/games/our-games" },
  relatedGuide: { slug: "split-the-g", label: "関連Guide" },
} satisfies QuizAnswerResult;

beforeEach(() => {
  actionMocks.submitQuizAnswer.mockReset();
});

describe("QuizCard", () => {
  it("回答前は問題と4択だけを表示し、正解・解説・情報源を公開しない", () => {
    render(<QuizCard question={question} labels={labels} />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /今日の問題:\s*次のうち、Gaelic Gamesに含まれる競技はどれですか？/,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "回答する" })).toBeDisabled();
    expect(screen.queryByText("解説")).not.toBeInTheDocument();
    expect(screen.queryByText(/Gaelic Athletic Association/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /関連Guide/ })).not.toBeInTheDocument();
  });

  it("正解を選ぶと正解・解説・情報源・関連Guideを表示し、回答を固定する", async () => {
    actionMocks.submitQuizAnswer.mockResolvedValue(correctResult);
    render(<QuizCard question={question} labels={labels} />);

    fireEvent.click(screen.getByRole("radio", { name: "Hurling" }));
    fireEvent.click(screen.getByRole("button", { name: "回答する" }));

    expect(await screen.findByRole("heading", { level: 3, name: "正解！ 🎉" })).toBeInTheDocument();
    expect(screen.getByText("HurlingはGaelic Gamesを構成する競技のひとつです。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "情報源: Gaelic Athletic Association" })).toHaveAttribute(
      "href",
      "https://www.gaa.ie/the-gaa/games/our-games",
    );
    expect(screen.getByRole("link", { name: "関連Guide →" })).toHaveAttribute("href", "/discover/guides/split-the-g");
    screen.getAllByRole("radio").forEach((radio) => {
      expect(radio).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "回答済み" })).toBeDisabled();
    expect(actionMocks.submitQuizAnswer).toHaveBeenCalledOnce();
  });

  it("不正解を選ぶと選択内容と正解を区別し、正解と解説を表示する", async () => {
    actionMocks.submitQuizAnswer.mockResolvedValue({
      ...correctResult,
      status: "incorrect",
      relatedGuide: undefined,
    });
    render(<QuizCard question={question} labels={labels} />);

    fireEvent.click(screen.getByRole("radio", { name: "Cricket" }));
    fireEvent.click(screen.getByRole("button", { name: "回答する" }));

    expect(await screen.findByRole("heading", { level: 3, name: "残念！" })).toBeInTheDocument();
    expect(screen.getByText("正解:")).toBeInTheDocument();
    expect(screen.getByText("Hurling", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Cricket" }).closest("label")).toHaveClass("quiz-choice-incorrect");
    expect(screen.getByRole("radio", { name: "Hurling" }).closest("label")).toHaveClass("quiz-choice-correct");
    expect(screen.queryByRole("link", { name: /関連Guide/ })).not.toBeInTheDocument();
  });

  it("採点エラーを読み上げ可能なメッセージとして表示し、再回答できる", async () => {
    actionMocks.submitQuizAnswer.mockRejectedValue(new Error("network"));
    render(<QuizCard question={question} labels={labels} />);

    fireEvent.click(screen.getByRole("radio", { name: "Hurling" }));
    fireEvent.click(screen.getByRole("button", { name: "回答する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("回答を採点できませんでした。");
    await waitFor(() => expect(screen.getByRole("button", { name: "回答する" })).toBeEnabled());
  });
});
