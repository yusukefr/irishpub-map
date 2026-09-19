import { describe, expect, it } from "vitest";
import { getEventsForDate, getEventsForMonth, getTodayInTokyo } from "../../apps/web/app/lib/calendar/queries";
import { getGregorianEasterDate, resolveDateRule } from "../../apps/web/app/lib/calendar/resolver";
import { parseCalendarDateRule } from "../../apps/web/app/lib/calendar/validation";
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

describe("calendar date rule validation", () => {
  const definitions = [
    { type: "fixed", month: 3, day: 17 },
    { type: "date_range", start: { month: 3, day: 1 }, end: { month: 3, day: 17 } },
    { type: "nth_weekday", month: 5, weekday: "monday", nth: 1 },
    { type: "last_weekday", month: 10, weekday: "monday" },
    { type: "relative_to_easter", offsetDays: -2 },
    { type: "weekday_on_or_after", month: 5, day: 3, weekday: "wednesday" },
    { type: "closest_weekday_to_date", month: 5, day: 14, weekday: "sunday" },
    {
      type: "rule_set",
      rules: [
        {
          when: { type: "fixed_date_weekday", month: 2, day: 1, weekday: "friday" },
          use: { type: "fixed", month: 2, day: 1 },
        },
        { when: { type: "otherwise" }, use: { type: "nth_weekday", month: 2, weekday: "monday", nth: 1 } },
      ],
    },
    { type: "annual_variable", usualMonth: 5, requiresOfficialConfirmation: true },
  ] as const;

  it("all Calendar Domain date rule types are parsed from persisted definitions", () => {
    expect(definitions.map((definition) => parseCalendarDateRule(definition, "date"))).toHaveLength(9);
  });

  it.each([
    ["unsupported type", { type: "unknown" }],
    ["invalid month", { type: "fixed", month: 13, day: 1 }],
    ["invalid weekday", { type: "last_weekday", month: 1, weekday: "nope" }],
    [
      "otherwise before a condition",
      {
        type: "rule_set",
        rules: [
          { when: { type: "otherwise" }, use: { type: "fixed", month: 1, day: 1 } },
          {
            when: { type: "fixed_date_weekday", month: 1, day: 2, weekday: "monday" },
            use: { type: "fixed", month: 1, day: 2 },
          },
        ],
      },
    ],
    [
      "duplicate otherwise",
      {
        type: "rule_set",
        rules: [
          { when: { type: "otherwise" }, use: { type: "fixed", month: 1, day: 1 } },
          { when: { type: "otherwise" }, use: { type: "fixed", month: 1, day: 2 } },
        ],
      },
    ],
  ])("%s is rejected", (_label, value) => {
    expect(() => parseCalendarDateRule(value, "date")).toThrow("Invalid calendar data");
  });
});

describe("calendar date resolver", () => {
  it("resolves all concrete date rule types", () => {
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

  it("rejects a fixed date that does not exist in the target year without rolling it forward", () => {
    expect(() => resolveDateRule({ type: "fixed", month: 2, day: 29 }, 2026)).toThrow("does not exist");
    expect(resolveDateRule({ type: "fixed", month: 2, day: 29 }, 2028)).toMatchObject({ start: { day: 29 } });
  });

  it.each([
    [2025, 4, 20],
    [2026, 4, 5],
    [2027, 3, 28],
  ])("calculates Easter and relative dates for %i", (year, month, day) => {
    expect(getGregorianEasterDate(year)).toEqual({ year, month, day });
    expect(resolveDateRule({ type: "relative_to_easter", offsetDays: -2 }, year)).toMatchObject({
      start: { day: day - 2 },
    });
    expect(resolveDateRule({ type: "relative_to_easter", offsetDays: 0 }, year)).toMatchObject({
      start: { day },
    });
    expect(resolveDateRule({ type: "relative_to_easter", offsetDays: 1 }, year)).toMatchObject({
      start: { day: day + 1 },
    });
  });

  it("uses the first matching rule in a valid rule set and rejects no match", () => {
    const ruleSet = parseCalendarDateRule(
      {
        type: "rule_set",
        rules: [
          {
            when: { type: "fixed_date_weekday", month: 2, day: 1, weekday: "friday" },
            use: { type: "fixed", month: 2, day: 1 },
          },
          { when: { type: "otherwise" }, use: { type: "fixed", month: 1, day: 2 } },
        ],
      },
      "date",
    );
    expect(resolveDateRule(ruleSet, 2026)).toMatchObject({ start: { month: 1, day: 2 } });
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

  it("resolves annual variable dates without inventing a concrete date", () => {
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
    event("condition", {
      type: "rule_set",
      rules: [
        {
          when: { type: "fixed_date_weekday", month: 2, day: 1, weekday: 5 },
          use: { type: "fixed", month: 2, day: 1 },
        },
        { when: { type: "otherwise" }, use: { type: "fixed", month: 2, day: 2 } },
      ],
    }),
    event("annual", { type: "annual_variable", usualMonth: 3, requiresOfficialConfirmation: true }),
  ];

  it("includes the start, middle, and end of ranges while excluding out-of-range and unresolved dates", () => {
    expect(getEventsForDate({ year: 2026, month: 3, day: 1 }, events).map(({ event }) => event.id)).toEqual(["range"]);
    expect(getEventsForDate({ year: 2026, month: 3, day: 10 }, events).map(({ event }) => event.id)).toEqual(["range"]);
    expect(getEventsForDate({ year: 2026, month: 3, day: 17 }, events).map(({ event }) => event.id)).toEqual([
      "range",
      "same-day-first",
      "same-day-second",
    ]);
    expect(getEventsForDate({ year: 2026, month: 3, day: 18 }, events)).toEqual([]);
  });

  it("returns the same synthetic event for the conditional rule", () => {
    expect(getEventsForDate({ year: 2026, month: 2, day: 2 }, events).map(({ event }) => event.id)).toContain(
      "condition",
    );
  });

  it("returns a range once in each month, including across year boundaries", () => {
    const spans = [
      event("month", { type: "date_range", start: { month: 3, day: 30 }, end: { month: 4, day: 2 } }),
      event("year", { type: "date_range", start: { month: 12, day: 30 }, end: { month: 1, day: 2 } }),
    ];
    expect(getEventsForMonth(2026, 3, spans).map(({ event }) => event.id)).toEqual(["month"]);
    expect(getEventsForMonth(2026, 4, spans).map(({ event }) => event.id)).toEqual(["month"]);
    expect(getEventsForMonth(2027, 1, spans).map(({ event }) => event.id)).toEqual(["year"]);
    expect(getEventsForDate({ year: 2027, month: 1, day: 1 }, spans).map(({ event }) => event.id)).toEqual(["year"]);
  });

  it("returns cross-year weekday rules in the correct month", () => {
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

  it("sorts monthly results by start date and keeps unresolved dates last", () => {
    expect(getEventsForMonth(2026, 3, events).map(({ event }) => event.id)).toEqual([
      "range",
      "same-day-first",
      "same-day-second",
      "annual",
    ]);
    expect(getEventsForMonth(2026, 9, events)).toEqual([]);
  });

  it("uses Asia/Tokyo date boundaries", () => {
    expect(getTodayInTokyo(new Date("2026-01-01T14:59:59Z"))).toEqual({ year: 2026, month: 1, day: 1 });
    expect(getTodayInTokyo(new Date("2026-01-01T15:00:00Z"))).toEqual({ year: 2026, month: 1, day: 2 });
  });
});
