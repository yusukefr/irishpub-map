import { describe, expect, it } from "vitest";
import rawCalendarData from "../../apps/web/data/ireland/calendar.json";
import { calendarData, parseCalendarData } from "../../apps/web/app/lib/calendar/data";
import { getEventsForDate, getEventsForMonth, getTodayInTokyo } from "../../apps/web/app/lib/calendar/queries";
import { getGregorianEasterDate, resolveDateRule } from "../../apps/web/app/lib/calendar/resolver";
import type { CalendarDateRule, CalendarEvent } from "../../apps/web/app/lib/calendar/types";

function event(id: string, date: CalendarDateRule): CalendarEvent {
  return {
    id,
    name: { ja: id, en: id },
    description: { ja: "", en: "" },
    date,
    category: "culture",
    isPublicHoliday: false,
    featured: false,
  };
}

describe("calendar data validation", () => {
  it("同梱JSON全体を検証し、不変のイベント一覧として読み込む", () => {
    expect(calendarData.events).toHaveLength(25);
    expect(calendarData.events.map(({ id }) => id)).toContain("st-patricks-day");
    expect(Object.isFrozen(calendarData.events)).toBe(true);
    expect(Object.isFrozen(calendarData.events[0]?.name)).toBe(true);
  });

  it.each([
    ["重複ID", (data: any) => data.events.push(structuredClone(data.events[0])), /events\[25\].*id.*unique/],
    ["未知カテゴリ", (data: any) => (data.events[0].category = "unknown"), /new-years-day.*category.*unsupported/],
    ["未知ルール", (data: any) => (data.events[0].date.type = "unknown"), /new-years-day.*date\.type.*unsupported/],
    ["不正月", (data: any) => (data.events[0].date.month = 13), /new-years-day.*date\.month.*between/],
    ["不正日", (data: any) => (data.events[0].date.day = 32), /new-years-day.*date\.day.*valid/],
    ["日本語名欠落", (data: any) => delete data.events[0].name.ja, /new-years-day.*name\.ja/],
    ["英語名欠落", (data: any) => delete data.events[0].name.en, /new-years-day.*name\.en/],
  ])("%sを場所の分かるエラーで拒否する", (_name, mutate, message) => {
    const data = structuredClone(rawCalendarData);
    mutate(data);
    expect(() => parseCalendarData(data)).toThrow(message);
  });
});

describe("calendar date resolver", () => {
  it("全具体日ルールを解決する", () => {
    expect(resolveDateRule({ type: "fixed", month: 3, day: 17 }, 2026)).toMatchObject({
      start: { year: 2026, month: 3, day: 17 },
    });
    expect(
      resolveDateRule({ type: "date_range", start: { month: 12, day: 30 }, end: { month: 1, day: 2 } }, 2026),
    ).toMatchObject({
      start: { year: 2026, month: 12, day: 30 },
      end: { year: 2027, month: 1, day: 2 },
    });
    expect(resolveDateRule({ type: "nth_weekday", month: 5, weekday: 1, nth: 1 }, 2026)).toMatchObject({
      start: { day: 4 },
    });
    expect(resolveDateRule({ type: "last_weekday", month: 10, weekday: 1 }, 2026)).toMatchObject({
      start: { day: 26 },
    });
    expect(resolveDateRule({ type: "weekday_on_or_after", month: 5, day: 3, weekday: 3 }, 2026)).toMatchObject({
      start: { day: 6 },
    });
    expect(resolveDateRule({ type: "closest_weekday_to_date", month: 5, day: 14, weekday: 0 }, 2026)).toMatchObject({
      start: { day: 17 },
    });
  });

  it("対象年に存在しない固定日を繰り上げず拒否する", () => {
    expect(() => resolveDateRule({ type: "fixed", month: 2, day: 29 }, 2026)).toThrow("does not exist");
    expect(resolveDateRule({ type: "fixed", month: 2, day: 29 }, 2028)).toMatchObject({ start: { day: 29 } });
  });

  it.each([
    [2025, 4, 20],
    [2026, 4, 5],
    [2027, 3, 28],
  ])("%i年の復活祭と前後日を算出する", (year, month, day) => {
    expect(getGregorianEasterDate(year)).toEqual({ year, month, day });
    expect(resolveDateRule({ type: "relative_to_easter", offsetDays: -2 }, year)).toMatchObject({
      start: { day: day - 2 },
    });
    expect(resolveDateRule({ type: "relative_to_easter", offsetDays: 1 }, year)).toMatchObject({
      start: { day: day + 1 },
    });
  });

  it("rule_setはJSON順で最初の一致を採用し、一致なしを拒否する", () => {
    expect(
      resolveDateRule(
        {
          type: "rule_set",
          rules: [
            { when: { type: "otherwise" }, use: { type: "fixed", month: 1, day: 2 } },
            { when: { type: "otherwise" }, use: { type: "fixed", month: 1, day: 3 } },
          ],
        },
        2026,
      ),
    ).toMatchObject({ start: { day: 2 } });
    expect(() =>
      resolveDateRule(
        {
          type: "rule_set",
          rules: [
            {
              when: { type: "fixed_date_weekday", month: 2, day: 1, weekday: 5 },
              use: { type: "fixed", month: 2, day: 1 },
            },
          ],
        },
        2026,
      ),
    ).toThrow("no matching rule");
  });

  it("実データの聖ブリジッド祝日ルールを年の曜日に応じて切り替える", () => {
    const holiday = calendarData.events.find(({ id }) => id === "st-brigids-public-holiday");
    expect(holiday).toBeDefined();
    expect(resolveDateRule(holiday!.date, 2030)).toMatchObject({ start: { month: 2, day: 1 } });
    expect(resolveDateRule(holiday!.date, 2026)).toMatchObject({ start: { month: 2, day: 2 } });
  });

  it("未確定日は通常月だけを返し、具体日を生成しない", () => {
    expect(
      resolveDateRule({ type: "annual_variable", usualMonth: 5, requiresOfficialConfirmation: true }, 2026),
    ).toEqual({
      status: "unresolved",
      usualMonth: 5,
      requiresOfficialConfirmation: true,
    });
  });
});

describe("calendar queries", () => {
  const events = [
    event("range", { type: "date_range", start: { month: 3, day: 1 }, end: { month: 3, day: 17 } }),
    event("same-day-first", { type: "fixed", month: 3, day: 17 }),
    event("same-day-second", { type: "fixed", month: 3, day: 17 }),
    event("annual", { type: "annual_variable", usualMonth: 3, requiresOfficialConfirmation: true }),
  ];

  it("期間の開始・途中・終了を含め、範囲外と未確定日を当日検索から除外する", () => {
    expect(getEventsForDate({ year: 2026, month: 3, day: 1 }, events).map(({ event }) => event.id)).toEqual(["range"]);
    expect(getEventsForDate({ year: 2026, month: 3, day: 10 }, events).map(({ event }) => event.id)).toEqual(["range"]);
    expect(getEventsForDate({ year: 2026, month: 3, day: 17 }, events).map(({ event }) => event.id)).toEqual([
      "range",
      "same-day-first",
      "same-day-second",
    ]);
    expect(getEventsForDate({ year: 2026, month: 3, day: 18 }, events)).toEqual([]);
  });

  it.each([
    [1, 6, "nollaig-na-mban"],
    [3, 17, "st-patricks-day"],
    [6, 16, "bloomsday"],
    [10, 31, "halloween"],
    [11, 1, "samhain"],
    [12, 26, "st-stephens-day"],
  ])("実データの2026-%i-%iに%sを返す", (month, day, id) => {
    expect(getEventsForDate({ year: 2026, month, day }).map(({ event }) => event.id)).toContain(id);
  });

  it("月跨ぎ・年跨ぎ期間を両方の月で一度だけ取得する", () => {
    const spans = [
      event("month", { type: "date_range", start: { month: 3, day: 30 }, end: { month: 4, day: 2 } }),
      event("year", { type: "date_range", start: { month: 12, day: 30 }, end: { month: 1, day: 2 } }),
    ];
    expect(getEventsForMonth(2026, 3, spans).map(({ event }) => event.id)).toEqual(["month"]);
    expect(getEventsForMonth(2026, 4, spans).map(({ event }) => event.id)).toEqual(["month"]);
    expect(getEventsForMonth(2027, 1, spans).map(({ event }) => event.id)).toEqual(["year"]);
    expect(getEventsForDate({ year: 2027, month: 1, day: 1 }, spans).map(({ event }) => event.id)).toEqual(["year"]);
  });

  it("年末年始を跨いで解決される単日ルールを日・月検索で取得する", () => {
    const crossingEvents = [
      event("after-year-end", {
        type: "weekday_on_or_after",
        month: 12,
        day: 31,
        weekday: 1,
      }),
      event("closest-before-year-start", {
        type: "closest_weekday_to_date",
        month: 1,
        day: 1,
        weekday: 3,
      }),
    ];

    expect(getEventsForDate({ year: 2027, month: 1, day: 4 }, crossingEvents).map(({ event }) => event.id)).toEqual([
      "after-year-end",
    ]);
    expect(getEventsForMonth(2027, 1, crossingEvents).map(({ event }) => event.id)).toEqual(["after-year-end"]);
    expect(getEventsForDate({ year: 2025, month: 12, day: 31 }, crossingEvents).map(({ event }) => event.id)).toEqual([
      "closest-before-year-start",
    ]);
    expect(getEventsForMonth(2025, 12, crossingEvents).map(({ event }) => event.id)).toEqual([
      "closest-before-year-start",
    ]);
  });

  it("月一覧を開始日順・同日JSON順・未確定日末尾に並べ、空月も返す", () => {
    expect(getEventsForMonth(2026, 3, events).map(({ event }) => event.id)).toEqual([
      "range",
      "same-day-first",
      "same-day-second",
      "annual",
    ]);
    expect(getEventsForMonth(2026, 9, events)).toEqual([]);
  });

  it("Asia/Tokyoの日付境界を使用する", () => {
    expect(getTodayInTokyo(new Date("2026-01-01T14:59:59Z"))).toEqual({ year: 2026, month: 1, day: 1 });
    expect(getTodayInTokyo(new Date("2026-01-01T15:00:00Z"))).toEqual({ year: 2026, month: 1, day: 2 });
  });
});
