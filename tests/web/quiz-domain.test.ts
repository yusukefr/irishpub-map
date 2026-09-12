import { describe, expect, it } from "vitest";
import rawQuizData from "../../apps/web/data/ireland/quiz.json";
import { parseQuizData, quizData } from "../../apps/web/app/lib/quiz/data";
import { getQuizDateInTokyo, gradeQuizAnswer, selectDailyQuiz } from "../../apps/web/app/lib/quiz/queries";
import type { QuizQuestion } from "../../apps/web/app/lib/quiz/types";

function question(id: string, specialDate?: Readonly<{ month: number; day: number }>): QuizQuestion {
  return {
    id,
    category: "ireland-basics",
    question: { ja: id, en: id },
    choices: [
      { id: "correct", label: { ja: "正解", en: "Correct" } },
      { id: "wrong-1", label: { ja: "不正解1", en: "Wrong 1" } },
      { id: "wrong-2", label: { ja: "不正解2", en: "Wrong 2" } },
      { id: "wrong-3", label: { ja: "不正解3", en: "Wrong 3" } },
    ],
    answer: "correct",
    explanation: { ja: "日本語の解説", en: "English explanation" },
    source: {
      label: { ja: "公式情報", en: "Official source" },
      url: "https://example.com/source",
    },
    ...(specialDate ? { specialDate } : {}),
  };
}

describe("quiz data validation", () => {
  it("同梱JSONの全カテゴリと9問を検証し、不変データとして読み込む", () => {
    expect(Object.keys(quizData.categories)).toHaveLength(8);
    expect(quizData.questions).toHaveLength(9);
    expect(new Set(quizData.questions.map(({ category }) => category))).toHaveLength(8);
    expect(Object.isFrozen(quizData.questions)).toBe(true);
    expect(Object.isFrozen(quizData.questions[0]?.choices)).toBe(true);
    expect(Object.isFrozen(quizData.questions[0]?.question)).toBe(true);
  });

  it.each([
    [
      "問題IDの重複",
      (data: any) => data.questions.push(structuredClone(data.questions[0])),
      /questions\[9\].*id.*unique/,
    ],
    [
      "未知カテゴリ",
      (data: any) => (data.questions[0].category = "unknown"),
      /ireland-basics-st-brigid-001.*category.*unsupported/,
    ],
    [
      "choice IDの重複",
      (data: any) => (data.questions[0].choices[1].id = data.questions[0].choices[0].id),
      /choices\[1\].*id.*unique/,
    ],
    [
      "存在しない正解",
      (data: any) => (data.questions[0].answer = "missing"),
      /ireland-basics-st-brigid-001.*answer.*existing choice/,
    ],
    [
      "日本語問題文の欠落",
      (data: any) => delete data.questions[0].question.ja,
      /ireland-basics-st-brigid-001.*question\.ja/,
    ],
    [
      "英語選択肢の欠落",
      (data: any) => delete data.questions[0].choices[0].label.en,
      /ireland-basics-st-brigid-001.*choices\[0\].*label\.en/,
    ],
    [
      "英語解説の欠落",
      (data: any) => delete data.questions[0].explanation.en,
      /ireland-basics-st-brigid-001.*explanation\.en/,
    ],
    [
      "不正な記念日",
      (data: any) => (data.questions[0].specialDate.day = 30),
      /ireland-basics-st-brigid-001.*specialDate\.day.*valid/,
    ],
    [
      "HTTPSでない情報源",
      (data: any) => (data.questions[0].source.url = "http://example.com"),
      /ireland-basics-st-brigid-001.*source\.url.*HTTPS/,
    ],
    [
      "不正な関連Guide slug",
      (data: any) => (data.questions[2].relatedGuide.slug = "Split the G"),
      /pub-guinness-st-james-gate-001.*relatedGuide\.slug.*kebab-case/,
    ],
  ])("%sを場所の分かるエラーで拒否する", (_name, mutate, message) => {
    const data = structuredClone(rawQuizData);
    mutate(data);
    expect(() => parseQuizData(data)).toThrow(message);
  });
});

describe("daily quiz selection", () => {
  it("Asia/Tokyoの日付境界を使用する", () => {
    expect(getQuizDateInTokyo(new Date("2026-01-01T14:59:59Z"))).toEqual({ year: 2026, month: 1, day: 1 });
    expect(getQuizDateInTokyo(new Date("2026-01-01T15:00:00Z"))).toEqual({ year: 2026, month: 1, day: 2 });
  });

  it("同じ日は再選択やLocaleに関係なく同じ問題IDを返す", () => {
    const date = { year: 2026, month: 9, day: 6 };
    const japaneseQuestion = selectDailyQuiz(date);
    const englishQuestion = selectDailyQuiz(date);

    expect(englishQuestion.id).toBe(japaneseQuestion.id);
    expect(englishQuestion.question.en).toBeTruthy();
    expect(japaneseQuestion.question.ja).toBeTruthy();
  });

  it("通常日は日付が変わると次の問題へ進む", () => {
    const questions = [question("first"), question("second"), question("third")];
    expect(selectDailyQuiz({ year: 2026, month: 9, day: 6 }, questions).id).not.toBe(
      selectDailyQuiz({ year: 2026, month: 9, day: 7 }, questions).id,
    );
  });

  it("specialDate一致問題を通常ローテーションより優先する", () => {
    const questions = [question("ordinary"), question("special", { month: 3, day: 17 })];
    expect(selectDailyQuiz({ year: 2026, month: 3, day: 17 }, questions).id).toBe("special");
  });

  it("同梱データでSt. Patrick's DayとBloomsdayの問題を優先する", () => {
    expect(selectDailyQuiz({ year: 2026, month: 3, day: 17 }).id).toBe("ireland-basics-st-patrick-001");
    expect(selectDailyQuiz({ year: 2026, month: 6, day: 16 }).id).toBe("literature-bloomsday-001");
  });

  it.each([
    { date: { year: 2026, month: 1, day: 31 }, specialId: "ireland-basics-st-brigid-001" },
    { date: { year: 2026, month: 2, day: 2 }, specialId: "ireland-basics-st-brigid-001" },
    { date: { year: 2026, month: 3, day: 16 }, specialId: "ireland-basics-st-patrick-001" },
    { date: { year: 2026, month: 3, day: 18 }, specialId: "ireland-basics-st-patrick-001" },
  ])("記念日の前日・翌日は記念日問題を通常ローテーションへ含めない", ({ date, specialId }) => {
    expect(selectDailyQuiz(date).id).not.toBe(specialId);
  });

  it("通常問題がない場合も記念日以外の日に決定的な問題を返す", () => {
    const questions = [question("special-only", { month: 3, day: 17 })];
    expect(selectDailyQuiz({ year: 2026, month: 3, day: 18 }, questions).id).toBe("special-only");
  });
});

describe("quiz answer grading", () => {
  const questions = [question("sample")];

  it("正解と不正解を判定し、指定Localeの正解・解説・情報源を返す", () => {
    expect(gradeQuizAnswer("sample", "correct", "ja", questions)).toMatchObject({
      status: "correct",
      correctChoiceLabel: "正解",
      explanation: "日本語の解説",
      source: { label: "公式情報" },
    });
    expect(gradeQuizAnswer("sample", "wrong-1", "en", questions)).toMatchObject({
      status: "incorrect",
      correctChoiceLabel: "Correct",
      explanation: "English explanation",
      source: { label: "Official source" },
    });
  });

  it("存在しない問題やchoiceを拒否する", () => {
    expect(() => gradeQuizAnswer("missing", "correct", "ja", questions)).toThrow("question was not found");
    expect(() => gradeQuizAnswer("sample", "missing", "ja", questions)).toThrow("choice was not found");
  });
});
