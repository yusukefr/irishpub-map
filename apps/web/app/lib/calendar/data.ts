import rawCalendarData from "../../../data/ireland/calendar.json";
import { isCalendarEventId, parseCalendarDateRule } from "./validation";
import type { CalendarCategory, CalendarData, CalendarDateRule, CalendarEvent, CalendarLocalizedText } from "./types";

const CATEGORY_IDS = [
  "public_holiday",
  "culture",
  "tradition",
  "language",
  "literature",
  "history",
  "religion",
] as const satisfies readonly CalendarCategory[];

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
] as const satisfies readonly CalendarDateRule["type"][];

function fail(path: string, message: string): never {
  throw new Error(`Invalid calendar data at ${path}: ${message}`);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "must be an object");
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    fail(path, allowEmpty ? "must be a string" : "must be a non-empty string");
  }
  return value;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "must be a boolean");
  return value;
}

function localizedText(value: unknown, path: string, allowEmpty = false): CalendarLocalizedText {
  const input = record(value, path);
  return Object.freeze({
    ja: string(input.ja, `${path}.ja`, allowEmpty),
    en: string(input.en, `${path}.en`, allowEmpty),
  });
}

function event(value: unknown, index: number): CalendarEvent {
  const basePath = `events[${index}]`;
  const input = record(value, basePath);
  const id = string(input.id, `${basePath}.id`);
  if (!isCalendarEventId(id)) fail(`${basePath}(${id}).id`, "must be a kebab-case stable ID");
  const category = string(input.category, `${basePath}(${id}).category`);
  if (!CATEGORY_IDS.includes(category as CalendarCategory))
    fail(`${basePath}(${id}).category`, `unsupported category "${category}"`);

  let aliases: readonly string[] | undefined;
  if (input.aliases !== undefined) {
    if (!Array.isArray(input.aliases)) fail(`${basePath}(${id}).aliases`, "must be an array");
    aliases = Object.freeze(
      input.aliases.map((alias, aliasIndex) => string(alias, `${basePath}(${id}).aliases[${aliasIndex}]`)),
    );
  }

  return Object.freeze({
    id,
    name: localizedText(input.name, `${basePath}(${id}).name`),
    date: parseCalendarDateRule(input.date, `${basePath}(${id}).date`),
    category: category as CalendarCategory,
    isPublicHoliday: boolean(input.isPublicHoliday, `${basePath}(${id}).isPublicHoliday`),
    featured: boolean(input.featured, `${basePath}(${id}).featured`),
    description: localizedText(input.description, `${basePath}(${id}).description`, true),
    ...(aliases ? { aliases } : {}),
    ...(input.source === undefined ? {} : { source: string(input.source, `${basePath}(${id}).source`) }),
  });
}

/** 未知のJSONを検証し、曜日名を数値へ正規化した不変のカレンダーデータへ変換します。
 * @param {unknown} value - 検証するJSON値。
 * @returns {CalendarData} 検証・正規化済みデータ。
 */
export function parseCalendarData(value: unknown): CalendarData {
  const input = record(value, "root");
  if (input.schemaVersion !== 1) fail("schemaVersion", "must be 1");
  if (input.country !== "IE") fail("country", 'must be "IE"');
  const scope = string(input.scope, "scope");

  const categoryInput = record(input.categories, "categories");
  const categories = Object.fromEntries(
    CATEGORY_IDS.map((id) => [id, localizedText(categoryInput[id], `categories.${id}`)]),
  ) as Record<CalendarCategory, CalendarLocalizedText>;

  const dateRuleTypes = input.dateRuleTypes;
  if (!Array.isArray(dateRuleTypes)) fail("dateRuleTypes", "must be an array");
  if (
    dateRuleTypes.length !== DATE_RULE_TYPES.length ||
    DATE_RULE_TYPES.some((type) => !dateRuleTypes.includes(type))
  ) {
    fail("dateRuleTypes", "must contain every supported date rule type exactly once");
  }
  if (new Set(dateRuleTypes).size !== dateRuleTypes.length) fail("dateRuleTypes", "must not contain duplicates");

  if (!Array.isArray(input.events)) fail("events", "must be an array");
  const events = Object.freeze(input.events.map(event));
  const seen = new Set<string>();
  events.forEach((item, index) => {
    if (seen.has(item.id)) fail(`events[${index}](${item.id}).id`, "must be unique");
    seen.add(item.id);
  });

  return Object.freeze({
    schemaVersion: 1,
    country: "IE",
    scope,
    categories: Object.freeze(categories),
    dateRuleTypes: Object.freeze([...DATE_RULE_TYPES]),
    events,
  });
}

/** リポジトリ同梱JSONを起動時に検証したカレンダーデータです。 */
export const calendarData = parseCalendarData(rawCalendarData);

/** JSON記載順を維持した検証済みイベント一覧です。 */
export const calendarEvents = calendarData.events;
