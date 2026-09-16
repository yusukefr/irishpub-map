import { describe, expect, it } from "vitest";
import sourceData from "../apps/web/data/ireland/calendar.json";
import {
  buildApplyQueries,
  buildDatabaseSnapshot,
  buildExpectedSnapshot,
  buildInsertQueries,
  classifyCalendarState,
  migrateCalendarData,
  parseCalendarMigrationData,
  parseMigrationArgs,
  snapshotsEqual,
} from "../scripts/migrate-calendar-data.mjs";

function sourceCopy() {
  return structuredClone(sourceData) as Record<string, any>;
}

function parsedSource() {
  return parseCalendarMigrationData(sourceCopy());
}

describe("calendar data migration validation", () => {
  it("validates the checked-in source and preserves event counts and order", () => {
    const data = parsedSource();
    expect(data.events).toHaveLength(25);
    expect(data.events.map((event: any) => event.id)).toEqual(
      expect.arrayContaining(["new-years-day", "st-patricks-day"]),
    );
    expect(new Set(data.events.map((event: any) => event.date.type))).toEqual(
      new Set([
        "fixed",
        "date_range",
        "nth_weekday",
        "last_weekday",
        "relative_to_easter",
        "weekday_on_or_after",
        "closest_weekday_to_date",
        "rule_set",
        "annual_variable",
      ]),
    );
  });

  it.each([
    ["unsupported category", (source: any) => (source.events[0].category = "unknown")],
    ["duplicate event ID", (source: any) => (source.events[1].id = source.events[0].id)],
    ["trimmed event ID", (source: any) => (source.events[0].id = " new-years-day")],
    ["invalid date rule", (source: any) => (source.events[0].date = { type: "unknown" })],
    [
      "invalid weekday",
      (source: any) => (source.events[0].date = { type: "nth_weekday", month: 1, weekday: "nope", nth: 1 }),
    ],
    ["invalid metadata country", (source: any) => (source.country = "JP")],
    ["duplicate date rule type", (source: any) => (source.dateRuleTypes[1] = source.dateRuleTypes[0])],
  ])("rejects %s", (_name, mutate) => {
    const source = sourceCopy();
    mutate(source);
    expect(() => parseCalendarMigrationData(source)).toThrow("Invalid calendar data");
  });

  it("rejects unknown CLI options and supports dry run/apply modes", () => {
    expect(parseMigrationArgs([])).toEqual({ apply: false });
    expect(parseMigrationArgs(["--apply"])).toEqual({ apply: true });
    expect(() => parseMigrationArgs(["--force"])).toThrow("Unknown or duplicate option");
    expect(() => parseMigrationArgs(["--apply", "--apply"])).toThrow("Unknown or duplicate option");
  });
});

describe("calendar data migration mapping", () => {
  it("maps IDs, Date Rules, translations, aliases, order, and publication", () => {
    const expected = buildExpectedSnapshot(parsedSource());
    expect(expected.events).toHaveLength(25);
    expect(expected.rowCounts).toEqual({ events: 25, translations: 50 });
    expect(expected.events.map((event: any) => event.sort_order)).toEqual([...Array(25).keys()]);
    expect(expected.events.every((event: any) => event.is_published)).toBe(true);
    expect(expected.events.find((event: any) => event.id === "new-years-day")).toMatchObject({
      aliases: [],
      date_rule: { type: "fixed", month: 1, day: 1 },
      source: "citizens_information",
    });
    expect(expected.events[0].translations).toHaveLength(2);
    expect(expected.events[0].translations.map((translation: any) => translation.locale)).toEqual(["ja", "en"]);
  });

  it("builds only INSERT queries and never uses overwrite or destructive SQL", () => {
    const expected = buildExpectedSnapshot(parsedSource());
    const queries: Array<{ text: string; values: unknown[] }> = [];
    const transaction = (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push({ text: strings.join("?"), values });
      return Promise.resolve();
    };
    buildInsertQueries(transaction, expected);
    expect(queries).toHaveLength(75);
    expect(queries.every((query) => query.text.includes("INSERT INTO"))).toBe(true);
    const sqlText = queries.map((query) => query.text).join("\n");
    expect(sqlText).not.toMatch(/ON CONFLICT|DELETE|TRUNCATE|UPDATE/u);
    expect(queries.some((query) => query.values.includes("new-years-day") && query.values.includes(true))).toBe(true);
  });
});

function rowsFromSnapshot(snapshot: any) {
  return {
    events: snapshot.events.map(({ translations, ...event }: any) => event),
    translations: snapshot.events.flatMap((event: any) =>
      event.translations.map((translation: any) => ({ event_id: event.id, ...translation })),
    ),
  };
}

function migrationSql(snapshot: any, options: { transactionError?: boolean; postMatch?: boolean } = {}) {
  const rows = rowsFromSnapshot(snapshot);
  let applied = false;
  let transactionCount = 0;
  const transactionQueries: string[] = [];
  const sql = ((strings: TemplateStringsArray) => {
    const query = strings.join("?");
    if (query.includes("FROM calendar_events"))
      return Promise.resolve(applied && options.postMatch !== false ? rows.events : []);
    if (query.includes("FROM calendar_event_translations")) {
      return Promise.resolve(applied && options.postMatch !== false ? rows.translations : []);
    }
    throw new Error(`Unexpected migration query: ${query}`);
  }) as any;
  sql.transaction = async (callback: (transaction: Function) => Promise<unknown>[]) => {
    transactionCount += 1;
    if (options.transactionError) throw new Error("transaction failed");
    const transaction = (strings: TemplateStringsArray) => {
      transactionQueries.push(strings.join("?"));
      return Promise.resolve();
    };
    await Promise.all(callback(transaction));
    applied = true;
  };
  return {
    sql,
    transactionQueries,
    get transactionCount() {
      return transactionCount;
    },
  };
}

describe("calendar data migration apply", () => {
  const expected = buildExpectedSnapshot(parsedSource());

  it("checks the empty state and inserts atomically, then verifies the snapshot", async () => {
    const fake = migrationSql(expected);
    await expect(migrateCalendarData({ apply: true, sql: fake.sql, data: sourceCopy() })).resolves.toEqual({
      status: "applied",
      eventCount: 25,
      translationCount: 50,
    });
    expect(fake.transactionCount).toBe(1);
    expect(fake.transactionQueries[0]).toContain("LOCK TABLE");
    expect(fake.transactionQueries[1]).toContain("RAISE EXCEPTION");
    expect(fake.transactionQueries.filter((query) => query.includes("INSERT INTO"))).toHaveLength(75);
  });

  it("does not report success when the transaction fails", async () => {
    const fake = migrationSql(expected, { transactionError: true });
    await expect(migrateCalendarData({ apply: true, sql: fake.sql, data: sourceCopy() })).rejects.toThrow(
      "transaction failed",
    );
    expect(fake.transactionCount).toBe(1);
  });

  it("rejects when post-migration snapshot validation fails", async () => {
    const fake = migrationSql(expected, { postMatch: false });
    await expect(migrateCalendarData({ apply: true, sql: fake.sql, data: sourceCopy() })).rejects.toThrow(
      "Post-migration Calendar snapshot does not match the source.",
    );
  });
});

describe("calendar data migration state", () => {
  it("classifies empty, already migrated, and unsafe states", () => {
    const expected = buildExpectedSnapshot(parsedSource());
    const empty = { events: [], rowCounts: { events: 0, translations: 0 } };
    expect(classifyCalendarState(empty, expected)).toBe("empty");
    expect(classifyCalendarState(expected, expected)).toBe("already_migrated");
    const inconsistent = structuredClone(expected);
    inconsistent.events[0].category = "changed";
    expect(snapshotsEqual(inconsistent, expected)).toBe(false);
    expect(classifyCalendarState(inconsistent, expected)).toBe("inconsistent");
    expect(classifyCalendarState({ events: [], rowCounts: { events: 0, translations: 1 } }, expected)).toBe(
      "inconsistent",
    );
  });

  it("supports a database-backed dry run without writing", async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://test-only";
    const queries: string[] = [];
    const sql = ((strings: TemplateStringsArray) => {
      queries.push(strings.join("?"));
      return Promise.resolve([]);
    }) as any;
    await expect(migrateCalendarData({ sql, data: sourceCopy() })).resolves.toMatchObject({ status: "dry_run_ready" });
    expect(queries.some((query) => query.includes("INSERT INTO"))).toBe(false);
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  });

  it("builds a database snapshot with nullable draft fields", () => {
    const snapshot = buildDatabaseSnapshot(
      [
        {
          id: "draft",
          category: null,
          date_rule: null,
          is_public_holiday: false,
          featured: false,
          aliases: [],
          source: null,
          sort_order: 0,
          is_published: false,
        },
      ],
      [],
    );
    expect(snapshot.events[0]).toMatchObject({ category: null, date_rule: null, source: null, translations: [] });
  });

  it("locks both tables before checking that they are empty", () => {
    const queries: string[] = [];
    const transaction = (strings: TemplateStringsArray) => {
      queries.push(strings.join("?"));
      return Promise.resolve();
    };
    buildApplyQueries(transaction, buildExpectedSnapshot(parsedSource()));
    expect(queries[0]).toContain("calendar_events, calendar_event_translations");
    expect(queries[1]).toContain("FROM calendar_events");
    expect(queries[1]).toContain("FROM calendar_event_translations");
  });
});
