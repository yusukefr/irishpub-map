import rawCalendarData from "../../../data/ireland/calendar.json";
import type {
  AnnualVariableRule,
  CalendarCategory,
  CalendarData,
  CalendarDateRule,
  CalendarEvent,
  CalendarLocalizedText,
  CalendarWeekday,
  ConcreteSingleDateRule,
  RuleSetCondition,
} from "./types";

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

const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
} as const satisfies Record<string, CalendarWeekday>;

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

function integer(value: unknown, path: string): number {
  if (!Number.isInteger(value)) fail(path, "must be an integer");
  return value as number;
}

function month(value: unknown, path: string): number {
  const parsed = integer(value, path);
  if (parsed < 1 || parsed > 12) fail(path, "must be between 1 and 12");
  return parsed;
}

function monthDay(value: unknown, path: string): Readonly<{ month: number; day: number }> {
  const input = record(value, path);
  const parsedMonth = month(input.month, `${path}.month`);
  const parsedDay = integer(input.day, `${path}.day`);
  const maximum = new Date(Date.UTC(2000, parsedMonth, 0)).getUTCDate();
  if (parsedDay < 1 || parsedDay > maximum) fail(`${path}.day`, `must be valid for month ${parsedMonth}`);
  return Object.freeze({ month: parsedMonth, day: parsedDay });
}

function weekday(value: unknown, path: string): CalendarWeekday {
  if (typeof value !== "string" || !(value in WEEKDAYS)) fail(path, "must be a supported weekday name");
  return WEEKDAYS[value as keyof typeof WEEKDAYS];
}

function localizedText(value: unknown, path: string, allowEmpty = false): CalendarLocalizedText {
  const input = record(value, path);
  return Object.freeze({
    ja: string(input.ja, `${path}.ja`, allowEmpty),
    en: string(input.en, `${path}.en`, allowEmpty),
  });
}

function concreteRule(value: unknown, path: string): ConcreteSingleDateRule {
  const input = record(value, path);
  const type = string(input.type, `${path}.type`);
  if (type === "fixed") return Object.freeze({ type, ...monthDay(input, path) });
  if (type === "nth_weekday") {
    const nth = integer(input.nth, `${path}.nth`);
    if (nth < 1 || nth > 5) fail(`${path}.nth`, "must be between 1 and 5");
    return Object.freeze({
      type,
      month: month(input.month, `${path}.month`),
      weekday: weekday(input.weekday, `${path}.weekday`),
      nth,
    });
  }
  if (type === "last_weekday") {
    return Object.freeze({
      type,
      month: month(input.month, `${path}.month`),
      weekday: weekday(input.weekday, `${path}.weekday`),
    });
  }
  if (type === "relative_to_easter") {
    return Object.freeze({ type, offsetDays: integer(input.offsetDays, `${path}.offsetDays`) });
  }
  if (type === "weekday_on_or_after" || type === "closest_weekday_to_date") {
    const date = monthDay(input, path);
    return Object.freeze({ type, ...date, weekday: weekday(input.weekday, `${path}.weekday`) });
  }
  return fail(`${path}.type`, `unsupported concrete date rule "${type}"`);
}

function condition(value: unknown, path: string): RuleSetCondition {
  const input = record(value, path);
  const type = string(input.type, `${path}.type`);
  if (type === "otherwise") return Object.freeze({ type });
  if (type === "fixed_date_weekday") {
    return Object.freeze({ type, ...monthDay(input, path), weekday: weekday(input.weekday, `${path}.weekday`) });
  }
  return fail(`${path}.type`, `unsupported rule-set condition "${type}"`);
}

function dateRule(value: unknown, path: string): CalendarDateRule {
  const input = record(value, path);
  const type = string(input.type, `${path}.type`);
  if (type === "date_range") {
    return Object.freeze({
      type,
      start: monthDay(input.start, `${path}.start`),
      end: monthDay(input.end, `${path}.end`),
    });
  }
  if (type === "rule_set") {
    if (!Array.isArray(input.rules) || input.rules.length === 0) fail(`${path}.rules`, "must be a non-empty array");
    return Object.freeze({
      type,
      rules: Object.freeze(
        input.rules.map((rule, index) => {
          const item = record(rule, `${path}.rules[${index}]`);
          return Object.freeze({
            when: condition(item.when, `${path}.rules[${index}].when`),
            use: concreteRule(item.use, `${path}.rules[${index}].use`),
          });
        }),
      ),
    });
  }
  if (type === "annual_variable") {
    return Object.freeze({
      type,
      usualMonth: month(input.usualMonth, `${path}.usualMonth`),
      requiresOfficialConfirmation: boolean(input.requiresOfficialConfirmation, `${path}.requiresOfficialConfirmation`),
    }) satisfies AnnualVariableRule;
  }
  return concreteRule(input, path);
}

function event(value: unknown, index: number): CalendarEvent {
  const basePath = `events[${index}]`;
  const input = record(value, basePath);
  const id = string(input.id, `${basePath}.id`);
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
    date: dateRule(input.date, `${basePath}(${id}).date`),
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
