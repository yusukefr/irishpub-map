import { describe, expect, it } from "vitest";
import { getQuizDateInTokyo, selectDailyQuiz } from "../../apps/web/app/lib/quiz/queries";

type Question = Readonly<{ id: string; specialDate?: Readonly<{ month: number; day: number }> }>;

function question(id: string, specialDate?: Readonly<{ month: number; day: number }>): Question {
  return { id, ...(specialDate ? { specialDate } : {}) };
}

describe("daily quiz selection", () => {
  it("uses the Asia/Tokyo calendar date boundary", () => {
    expect(getQuizDateInTokyo(new Date("2026-01-01T14:59:59Z"))).toEqual({ year: 2026, month: 1, day: 1 });
    expect(getQuizDateInTokyo(new Date("2026-01-01T15:00:00Z"))).toEqual({ year: 2026, month: 1, day: 2 });
  });

  it.each([
    { year: 1582, month: 12, day: 31 },
    { year: 2026, month: 0, day: 1 },
    { year: 2026, month: 13, day: 1 },
    { year: 2026, month: 2, day: 30 },
  ])("rejects an invalid date: $year-$month-$day", (date) => {
    expect(() => selectDailyQuiz(date, [question("sample")])).toThrow("A valid quiz date of 1583 or later is required");
  });

  it("selects the same question for the same date and question set", () => {
    const questions = [question("first"), question("second"), question("third")];
    const date = { year: 2026, month: 9, day: 6 };

    expect(selectDailyQuiz(date, questions).id).toBe(selectDailyQuiz(date, questions).id);
  });

  it("advances through regular questions as the date changes", () => {
    const questions = [question("first"), question("second"), question("third")];
    expect(selectDailyQuiz({ year: 2026, month: 9, day: 6 }, questions).id).not.toBe(
      selectDailyQuiz({ year: 2026, month: 9, day: 7 }, questions).id,
    );
  });

  it("prioritizes a matching special date over regular rotation", () => {
    const questions = [question("ordinary"), question("special", { month: 3, day: 17 })];
    expect(selectDailyQuiz({ year: 2026, month: 3, day: 17 }, questions).id).toBe("special");
  });

  it("selects among multiple special-date questions deterministically", () => {
    const questions = [
      question("ordinary"),
      question("special-a", { month: 3, day: 17 }),
      question("special-b", { month: 3, day: 17 }),
    ];
    const date = { year: 2026, month: 3, day: 17 };
    const selected = selectDailyQuiz(date, questions).id;

    expect(["special-a", "special-b"]).toContain(selected);
    expect(selectDailyQuiz(date, questions).id).toBe(selected);
  });

  it("excludes special-date questions from regular rotation", () => {
    const questions = [question("special", { month: 3, day: 17 }), question("regular-a"), question("regular-b")];
    expect(selectDailyQuiz({ year: 2026, month: 3, day: 16 }, questions).id).not.toBe("special");
    expect(selectDailyQuiz({ year: 2026, month: 3, day: 18 }, questions).id).not.toBe("special");
  });

  it("falls back to all questions when there are no regular questions", () => {
    const questions = [question("special-only", { month: 3, day: 17 })];
    expect(selectDailyQuiz({ year: 2026, month: 3, day: 18 }, questions).id).toBe("special-only");
  });

  it("rejects an empty question set", () => {
    expect(() => selectDailyQuiz({ year: 2026, month: 9, day: 6 }, [])).toThrow(
      "At least one quiz question is required",
    );
  });
});
