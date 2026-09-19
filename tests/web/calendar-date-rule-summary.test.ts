import { describe, expect, it } from "vitest";
import { formatCalendarDateRuleSummary } from "../../apps/web/app/lib/calendar/date-rule-summary";

describe("calendar date rule summary", () => {
  it.each([
    [-2, "復活祭の日曜日の2日前", "2 days before Easter Sunday"],
    [0, "復活祭の日曜日", "Easter Sunday"],
    [1, "復活祭の日曜日の1日後", "1 day after Easter Sunday"],
    [2, "復活祭の日曜日の2日後", "2 days after Easter Sunday"],
  ])("formats Easter offset %i in Japanese and English", (offsetDays, japanese, english) => {
    const rule = { type: "relative_to_easter", offsetDays } as const;
    expect(formatCalendarDateRuleSummary(rule, "ja")).toBe(japanese);
    expect(formatCalendarDateRuleSummary(rule, "en")).toBe(english);
  });
});
