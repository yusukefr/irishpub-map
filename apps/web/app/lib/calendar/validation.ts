import type {
  AnnualVariableRule,
  CalendarDateRule,
  CalendarDateRuleDefinition,
  CalendarWeekday,
  CalendarWeekdayName,
  ConcreteSingleDateRule,
  RuleSetCondition,
} from "./types";

const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
} as const satisfies Record<CalendarWeekdayName, CalendarWeekday>;
type DefinitionRuleSetCondition =
  | Readonly<{ type: "fixed_date_weekday"; month: number; day: number; weekday: CalendarWeekdayName }>
  | Readonly<{ type: "otherwise" }>;

/** Calendar Event IDの最大長です。 */
export const CALENDAR_ID_MAX_LENGTH = 100;

/** Calendar Eventで利用できるStable IDの形式です。 */
export const CALENDAR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/**
 * 指定値がCalendar EventのStable ID形式か判定します。
 * @param value
 * @returns Stable ID形式の場合はtrue。
 */
export function isCalendarEventId(value: string): boolean {
  return value.length <= CALENDAR_ID_MAX_LENGTH && CALENDAR_ID_PATTERN.test(value);
}

/** Stable ID validationの短縮API名です。 */
export const isCalendarId = isCalendarEventId;

/**
 * 永続化形式のDate Ruleを検証し、Runtime形式へ正規化します。
 * @param value
 * @param path
 * @returns Runtime形式へ正規化されたDate Rule。
 */
export function parseCalendarDateRule(value: unknown, path: string): CalendarDateRule {
  return normalizeCalendarDateRule(parseCalendarDateRuleDefinition(value, path));
}

/**
 * 永続化・Admin入力形式のDate Ruleを検証し、既知項目だけで再構築します。
 * @param value
 * @param path
 * @returns Canonicalな永続化形式Date Rule。
 */
export function parseCalendarDateRuleDefinition(value: unknown, path: string): CalendarDateRuleDefinition {
  const input = record(value, path);
  const type = string(input.type, path + ".type");
  if (type === "date_range") {
    return Object.freeze({
      type,
      start: monthDay(input.start, path + ".start"),
      end: monthDay(input.end, path + ".end"),
    });
  }
  if (type === "rule_set") {
    if (!Array.isArray(input.rules) || input.rules.length === 0) fail(path + ".rules", "must be a non-empty array");
    return Object.freeze({
      type,
      rules: Object.freeze(
        input.rules.map((rule, index) => {
          const item = record(rule, path + ".rules[" + index + "]");
          return Object.freeze({
            when: parseCondition(item.when, path + ".rules[" + index + "].when"),
            use: parseConcreteRule(item.use, path + ".rules[" + index + "].use"),
          });
        }),
      ),
    });
  }
  if (type === "annual_variable") {
    return Object.freeze({
      type,
      usualMonth: month(input.usualMonth, path + ".usualMonth"),
      requiresOfficialConfirmation: boolean(input.requiresOfficialConfirmation, path + ".requiresOfficialConfirmation"),
    }) satisfies AnnualVariableRule;
  }
  return parseConcreteRule(input, path);
}

/**
 * 永続化形式のDate RuleをRuntime形式へ変換します。
 * @param value
 * @returns Runtime形式へ正規化されたDate Rule。
 */
export function normalizeCalendarDateRule(value: CalendarDateRuleDefinition): CalendarDateRule {
  if (value.type === "date_range") return Object.freeze({ type: value.type, start: value.start, end: value.end });
  if (value.type === "rule_set") {
    return Object.freeze({
      type: value.type,
      rules: Object.freeze(
        value.rules.map((item) =>
          Object.freeze({
            when: normalizeCondition(item.when),
            use: normalizeConcreteRule(item.use),
          }),
        ),
      ),
    });
  }
  if (value.type === "annual_variable") return Object.freeze({ ...value });
  return normalizeConcreteRule(value);
}

function parseConcreteRule(
  value: unknown,
  path: string,
): Exclude<CalendarDateRuleDefinition, { type: "date_range" | "rule_set" | "annual_variable" }> {
  const input = record(value, path);
  const type = string(input.type, path + ".type");
  if (type === "fixed") return Object.freeze({ type, ...monthDay(input, path) });
  if (type === "nth_weekday") {
    const nth = integer(input.nth, path + ".nth");
    if (nth < 1 || nth > 5) fail(path + ".nth", "must be between 1 and 5");
    return Object.freeze({
      type,
      month: month(input.month, path + ".month"),
      weekday: weekdayName(input.weekday, path + ".weekday"),
      nth,
    });
  }
  if (type === "last_weekday") {
    return Object.freeze({
      type,
      month: month(input.month, path + ".month"),
      weekday: weekdayName(input.weekday, path + ".weekday"),
    });
  }
  if (type === "relative_to_easter") {
    return Object.freeze({ type, offsetDays: integer(input.offsetDays, path + ".offsetDays") });
  }
  if (type === "weekday_on_or_after" || type === "closest_weekday_to_date") {
    return Object.freeze({
      type,
      ...monthDay(input, path),
      weekday: weekdayName(input.weekday, path + ".weekday"),
    });
  }
  return fail(path + ".type", 'unsupported concrete date rule "' + type + '"');
}

function parseCondition(value: unknown, path: string): DefinitionRuleSetCondition {
  const input = record(value, path);
  const type = string(input.type, path + ".type");
  if (type === "otherwise") return Object.freeze({ type });
  if (type === "fixed_date_weekday") {
    return Object.freeze({
      type,
      ...monthDay(input, path),
      weekday: weekdayName(input.weekday, path + ".weekday"),
    });
  }
  return fail(path + ".type", 'unsupported rule-set condition "' + type + '"');
}

function normalizeConcreteRule(
  value: Exclude<CalendarDateRuleDefinition, { type: "date_range" | "rule_set" | "annual_variable" }>,
): ConcreteSingleDateRule {
  if (value.type === "fixed") return Object.freeze({ ...value });
  if (value.type === "nth_weekday") return Object.freeze({ ...value, weekday: WEEKDAYS[value.weekday] });
  if (value.type === "last_weekday") return Object.freeze({ ...value, weekday: WEEKDAYS[value.weekday] });
  if (value.type === "relative_to_easter") return Object.freeze({ ...value });
  return Object.freeze({ ...value, weekday: WEEKDAYS[value.weekday] });
}

function normalizeCondition(value: DefinitionRuleSetCondition): RuleSetCondition {
  if (value.type === "otherwise") return Object.freeze({ type: value.type });
  return Object.freeze({ ...value, weekday: WEEKDAYS[value.weekday] });
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "must be an object");
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) fail(path, "must be a non-empty string");
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
  const parsedMonth = month(input.month, path + ".month");
  const parsedDay = integer(input.day, path + ".day");
  const maximum = new Date(Date.UTC(2000, parsedMonth, 0)).getUTCDate();
  if (parsedDay < 1 || parsedDay > maximum) fail(path + ".day", "must be valid for month " + parsedMonth);
  return Object.freeze({ month: parsedMonth, day: parsedDay });
}

function weekdayName(value: unknown, path: string): CalendarWeekdayName {
  if (typeof value !== "string" || !(value in WEEKDAYS)) fail(path, "must be a supported weekday name");
  return value as CalendarWeekdayName;
}

function fail(path: string, message: string): never {
  throw new Error("Invalid calendar data at " + path + ": " + message);
}
