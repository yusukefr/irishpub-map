import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

export const CALENDAR_SOURCE_PATH = "apps/web/data/ireland/calendar.json";
const LOCALES = ["ja", "en"];
const CALENDAR_CATEGORIES = ["public_holiday", "culture", "tradition", "language", "literature", "history", "religion"];
const DATE_RULE_TYPES = [
  "fixed",
  "date_range",
  "nth_weekday",
  "last_weekday",
  "relative_to_easter",
  "weekday_on_or_after",
  "closest_weekday_to_date",
  "rule_set",
  "annual_variable",
];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function invalid(path, message) {
  throw new Error(`Invalid calendar data at ${path}: ${message}`);
}

function object(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(path, "must be an object");
  return value;
}

function requiredString(value, path, allowEmpty = false) {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    invalid(path, allowEmpty ? "must be a string" : "must be a non-empty string");
  }
  return value;
}

function idString(value, path) {
  const id = requiredString(value, path);
  if (id !== id.trim()) invalid(path, "must not have leading or trailing whitespace");
  return id;
}

function boolean(value, path) {
  if (typeof value !== "boolean") invalid(path, "must be a boolean");
  return value;
}

function integer(value, path) {
  if (!Number.isInteger(value)) invalid(path, "must be an integer");
  return value;
}

function month(value, path) {
  const parsed = integer(value, path);
  if (parsed < 1 || parsed > 12) invalid(path, "must be between 1 and 12");
  return parsed;
}

function monthDay(value, path) {
  const input = object(value, path);
  const parsedMonth = month(input.month, `${path}.month`);
  const parsedDay = integer(input.day, `${path}.day`);
  const maximum = new Date(Date.UTC(2000, parsedMonth, 0)).getUTCDate();
  if (parsedDay < 1 || parsedDay > maximum) invalid(`${path}.day`, `must be valid for month ${parsedMonth}`);
}

function weekday(value, path) {
  if (typeof value !== "string" || !WEEKDAYS.includes(value)) invalid(path, "must be a supported weekday name");
}

function localized(value, path, allowEmpty = false) {
  const input = object(value, path);
  requiredString(input.ja, `${path}.ja`, allowEmpty);
  requiredString(input.en, `${path}.en`, allowEmpty);
}

function validateConcreteRule(value, path) {
  const input = object(value, path);
  const type = requiredString(input.type, `${path}.type`);
  if (type === "fixed") {
    monthDay(input, path);
    return;
  }
  if (type === "nth_weekday") {
    month(input.month, `${path}.month`);
    weekday(input.weekday, `${path}.weekday`);
    const nth = integer(input.nth, `${path}.nth`);
    if (nth < 1 || nth > 5) invalid(`${path}.nth`, "must be between 1 and 5");
    return;
  }
  if (type === "last_weekday") {
    month(input.month, `${path}.month`);
    weekday(input.weekday, `${path}.weekday`);
    return;
  }
  if (type === "relative_to_easter") {
    integer(input.offsetDays, `${path}.offsetDays`);
    return;
  }
  if (type === "weekday_on_or_after" || type === "closest_weekday_to_date") {
    monthDay(input, path);
    weekday(input.weekday, `${path}.weekday`);
    return;
  }
  invalid(`${path}.type`, `unsupported concrete date rule "${type}"`);
}

function validateCondition(value, path) {
  const input = object(value, path);
  const type = requiredString(input.type, `${path}.type`);
  if (type === "otherwise") return;
  if (type === "fixed_date_weekday") {
    monthDay(input, path);
    weekday(input.weekday, `${path}.weekday`);
    return;
  }
  invalid(`${path}.type`, `unsupported rule-set condition "${type}"`);
}

function validateDateRule(value, path) {
  const input = object(value, path);
  const type = requiredString(input.type, `${path}.type`);
  if (type === "date_range") {
    monthDay(input.start, `${path}.start`);
    monthDay(input.end, `${path}.end`);
    return;
  }
  if (type === "rule_set") {
    if (!Array.isArray(input.rules) || input.rules.length === 0) invalid(`${path}.rules`, "must be a non-empty array");
    input.rules.forEach((rule, index) => {
      const item = object(rule, `${path}.rules[${index}]`);
      validateCondition(item.when, `${path}.rules[${index}].when`);
      validateConcreteRule(item.use, `${path}.rules[${index}].use`);
    });
    return;
  }
  if (type === "annual_variable") {
    month(input.usualMonth, `${path}.usualMonth`);
    boolean(input.requiresOfficialConfirmation, `${path}.requiresOfficialConfirmation`);
    return;
  }
  validateConcreteRule(input, path);
}

function validateEvent(value, index) {
  const basePath = `events[${index}]`;
  const input = object(value, basePath);
  const id = idString(input.id, `${basePath}.id`);
  localized(input.name, `${basePath}(${id}).name`);
  validateDateRule(input.date, `${basePath}(${id}).date`);
  const category = requiredString(input.category, `${basePath}(${id}).category`);
  if (!CALENDAR_CATEGORIES.includes(category)) {
    invalid(`${basePath}(${id}).category`, `unsupported category "${category}"`);
  }
  boolean(input.isPublicHoliday, `${basePath}(${id}).isPublicHoliday`);
  boolean(input.featured, `${basePath}(${id}).featured`);
  localized(input.description, `${basePath}(${id}).description`, true);
  if (input.aliases !== undefined) {
    if (!Array.isArray(input.aliases)) invalid(`${basePath}(${id}).aliases`, "must be an array");
    input.aliases.forEach((alias, aliasIndex) => requiredString(alias, `${basePath}(${id}).aliases[${aliasIndex}]`));
  }
  if (input.source !== undefined) requiredString(input.source, `${basePath}(${id}).source`);
  return input;
}

/**
 * Migration元JSONを検証し、JSON保存形式を維持した値へ変換します。
 * @param {unknown} value 検証対象のJSON値。
 * @returns {object} 検証済みCalendarデータ。
 */
export function parseCalendarMigrationData(value) {
  const input = object(value, "root");
  if (input.schemaVersion !== 1) invalid("schemaVersion", "must be 1");
  if (input.country !== "IE") invalid("country", 'must be "IE"');
  requiredString(input.scope, "scope");

  const categories = object(input.categories, "categories");
  CALENDAR_CATEGORIES.forEach((category) => localized(categories[category], `categories.${category}`));

  if (!Array.isArray(input.dateRuleTypes)) invalid("dateRuleTypes", "must be an array");
  if (
    input.dateRuleTypes.length !== DATE_RULE_TYPES.length ||
    DATE_RULE_TYPES.some((type) => !input.dateRuleTypes.includes(type))
  ) {
    invalid("dateRuleTypes", "must contain every supported date rule type exactly once");
  }
  if (new Set(input.dateRuleTypes).size !== input.dateRuleTypes.length) {
    invalid("dateRuleTypes", "must not contain duplicates");
  }

  if (!Array.isArray(input.events) || input.events.length === 0) invalid("events", "must be a non-empty array");
  const events = input.events.map(validateEvent);
  const ids = new Set();
  events.forEach((event, index) => {
    if (ids.has(event.id)) invalid(`events[${index}](${event.id}).id`, "must be unique");
    ids.add(event.id);
  });
  return { schemaVersion: 1, country: "IE", scope: input.scope, categories, dateRuleTypes: DATE_RULE_TYPES, events };
}

/** 固定JSONを読み込みます。Migration元の差し替えは受け付けません。 */
export async function loadCalendarSource() {
  const text = await readFile(resolve(process.cwd(), CALENDAR_SOURCE_PATH), "utf8");
  try {
    return parseCalendarMigrationData(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON source: ${CALENDAR_SOURCE_PATH}`);
    throw error;
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

/** 検証済みJSONをDB比較・INSERT用のExpected Snapshotへ変換します。 */
export function buildExpectedSnapshot(data) {
  const events = data.events.map((event, sort_order) => ({
    id: event.id,
    category: event.category,
    date_rule: canonicalize(event.date),
    is_public_holiday: event.isPublicHoliday,
    featured: event.featured,
    aliases: event.aliases ?? [],
    source: event.source ?? null,
    sort_order,
    is_published: true,
    translations: LOCALES.map((locale) => ({
      locale,
      name: event.name[locale],
      description: event.description[locale],
    })),
  }));
  return {
    events,
    rowCounts: {
      events: events.length,
      translations: events.reduce((count, event) => count + event.translations.length, 0),
    },
  };
}

function requiredDbString(value, field, allowEmpty = false) {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    throw new Error(`Invalid Calendar database value: ${field}`);
  }
  return value;
}

function nullableDbString(value, field, allowEmpty = false) {
  if (value === null || value === undefined) return null;
  return requiredDbString(value, field, allowEmpty);
}

function requiredDbInteger(value, field) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed)) throw new Error(`Invalid Calendar database value: ${field}`);
  return parsed;
}

function requiredDbBoolean(value, field) {
  if (typeof value !== "boolean") throw new Error(`Invalid Calendar database value: ${field}`);
  return value;
}

function requiredDbArray(value, field) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid Calendar database value: ${field}`);
  }
  return value;
}

function nullableDbJson(value, field) {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid Calendar database value: ${field}`);
  }
  return canonicalize(value);
}

/** NeonのCalendar全行を比較用Snapshotへ変換します。 */
export function buildDatabaseSnapshot(eventRows, translationRows) {
  const events = eventRows.map((row) => ({
    id: requiredDbString(row.id, "calendar_events.id"),
    category: nullableDbString(row.category, "calendar_events.category"),
    date_rule: nullableDbJson(row.date_rule, "calendar_events.date_rule"),
    is_public_holiday: requiredDbBoolean(row.is_public_holiday, "calendar_events.is_public_holiday"),
    featured: requiredDbBoolean(row.featured, "calendar_events.featured"),
    aliases: requiredDbArray(row.aliases, "calendar_events.aliases"),
    source: nullableDbString(row.source, "calendar_events.source"),
    sort_order: requiredDbInteger(row.sort_order, "calendar_events.sort_order"),
    is_published: requiredDbBoolean(row.is_published, "calendar_events.is_published"),
    translations: translationRows
      .filter((translation) => translation.event_id === row.id)
      .map((translation) => ({
        locale: requiredDbString(translation.locale, "calendar_event_translations.locale"),
        name: requiredDbString(translation.name, "calendar_event_translations.name"),
        description: requiredDbString(translation.description, "calendar_event_translations.description", true),
      })),
  }));
  return { events, rowCounts: { events: eventRows.length, translations: translationRows.length } };
}

/** DBからCalendar全テーブルを読み取ります。 */
export async function readCalendarSnapshot(sql) {
  const [events, translations] = await Promise.all([
    sql`SELECT id, category, date_rule, is_public_holiday, featured, aliases, source, sort_order, is_published FROM calendar_events ORDER BY id`,
    sql`SELECT event_id, locale, name, description FROM calendar_event_translations ORDER BY event_id, locale`,
  ]);
  return buildDatabaseSnapshot(events, translations);
}

function sortSnapshot(snapshot) {
  return {
    events: [...snapshot.events]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((event) => ({
        ...event,
        date_rule: canonicalize(event.date_rule),
        translations: [...event.translations].sort((left, right) => left.locale.localeCompare(right.locale)),
      })),
    rowCounts: snapshot.rowCounts,
  };
}

/** 2つのCalendar Snapshotが内容・件数とも完全一致するか判定します。 */
export function snapshotsEqual(left, right) {
  return JSON.stringify(sortSnapshot(left)) === JSON.stringify(sortSnapshot(right));
}

/** DBの状態を空・完全移行済み・不一致に分類します。 */
export function classifyCalendarState(current, expected) {
  if (Object.values(current.rowCounts).every((count) => count === 0)) return "empty";
  return snapshotsEqual(current, expected) ? "already_migrated" : "inconsistent";
}

/** Snapshotを単一TransactionへINSERTするQuery列を作成します。既存行の更新・削除は行いません。 */
export function buildInsertQueries(transaction, snapshot) {
  const queries = [];
  for (const event of snapshot.events) {
    queries.push(transaction`
      INSERT INTO calendar_events (
        id, category, date_rule, is_public_holiday, featured, aliases, source, sort_order, is_published
      ) VALUES (
        ${event.id}, ${event.category}, ${event.date_rule === null ? null : JSON.stringify(event.date_rule)}::jsonb,
        ${event.is_public_holiday}, ${event.featured}, ${event.aliases}, ${event.source}, ${event.sort_order}, ${event.is_published}
      )
    `);
    for (const translation of event.translations) {
      queries.push(transaction`
        INSERT INTO calendar_event_translations (event_id, locale, name, description)
        VALUES (${event.id}, ${translation.locale}, ${translation.name}, ${translation.description})
      `);
    }
  }
  return queries;
}

/** Calendar両テーブルの空状態確認とINSERTを同じTransactionで実行します。 */
export function buildApplyQueries(transaction, snapshot) {
  return [
    transaction`
      LOCK TABLE calendar_events, calendar_event_translations IN SHARE ROW EXCLUSIVE MODE
    `,
    transaction`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM calendar_events)
          OR EXISTS (SELECT 1 FROM calendar_event_translations)
        THEN
          RAISE EXCEPTION 'Calendar tables are not empty; migration aborted.';
        END IF;
      END
      $$
    `,
    ...buildInsertQueries(transaction, snapshot),
  ];
}

function parseArgs(args) {
  if (args.length === 0) return { apply: false };
  if (args.length === 1 && args[0] === "--apply") return { apply: true };
  throw new Error(`Unknown or duplicate option: ${args.join(" ")}`);
}

export { parseCalendarMigrationData as parseCalendarData, parseArgs as parseMigrationArgs };

async function applySnapshot(sql, snapshot) {
  await sql.transaction((transaction) => buildApplyQueries(transaction, snapshot), {
    isolationLevel: "ReadCommitted",
  });
}

/**
 * Calendar Data MigrationのDry RunまたはApplyを実行します。
 * @param {{apply?: boolean, sql?: Function, data?: object}} options 実行オプション。
 * @returns {Promise<{status: string, eventCount: number, translationCount: number}>} 実行結果。
 */
export async function migrateCalendarData({ apply = false, sql, data } = {}) {
  if (!process.env.DATABASE_URL && !sql) throw new Error("DATABASE_URL is required.");
  sql ??= neon(process.env.DATABASE_URL);
  const parsed = parseCalendarMigrationData(data ?? (await loadCalendarSource()));
  const expected = buildExpectedSnapshot(parsed);
  const current = await readCalendarSnapshot(sql);
  const state = classifyCalendarState(current, expected);
  if (state === "inconsistent") {
    throw new Error("Calendar tables are not empty and do not match the migration source. Migration aborted.");
  }
  if (state === "already_migrated") {
    return {
      status: "already_migrated",
      eventCount: expected.rowCounts.events,
      translationCount: expected.rowCounts.translations,
    };
  }
  if (!apply) {
    return {
      status: "dry_run_ready",
      eventCount: expected.rowCounts.events,
      translationCount: expected.rowCounts.translations,
    };
  }
  await applySnapshot(sql, expected);
  const migrated = await readCalendarSnapshot(sql);
  if (!snapshotsEqual(migrated, expected)) {
    throw new Error("Post-migration Calendar snapshot does not match the source.");
  }
  return {
    status: "applied",
    eventCount: expected.rowCounts.events,
    translationCount: expected.rowCounts.translations,
  };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const result = await migrateCalendarData({ apply, sql: neon(process.env.DATABASE_URL) });
  if (result.status === "dry_run_ready") {
    console.log(
      `Calendar data migration is ready: ${result.eventCount} events, ${result.translationCount} translations. No data was written.`,
    );
  } else if (result.status === "already_migrated") {
    console.log(
      `Calendar data is already migrated: ${result.eventCount} events, ${result.translationCount} translations. No data was written.`,
    );
  } else {
    console.log(
      `Calendar data migration applied and verified: ${result.eventCount} events, ${result.translationCount} translations.`,
    );
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Calendar data migration failed.");
    process.exitCode = 1;
  });
}
