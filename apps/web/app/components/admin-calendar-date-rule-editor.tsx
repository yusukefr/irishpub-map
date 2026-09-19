"use client";

import type { Locale } from "../lib/i18n";
import { getTranslation } from "../lib/i18n";
import type { CalendarDateRuleDefinition, CalendarWeekdayName } from "../lib/calendar/types";

type Props = {
  value: CalendarDateRuleDefinition | null;
  locale: Locale;
  disabled?: boolean;
  onChange: (value: CalendarDateRuleDefinition | null) => void;
};

type ConcreteRule = Exclude<CalendarDateRuleDefinition, { type: "date_range" | "rule_set" | "annual_variable" }>;
type RuleSetRule = Extract<CalendarDateRuleDefinition, { type: "rule_set" }>;
type RuleSetItem = RuleSetRule["rules"][number];
const WEEKDAYS: readonly CalendarWeekdayName[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const CONCRETE_TYPES: readonly ConcreteRule["type"][] = [
  "fixed",
  "nth_weekday",
  "last_weekday",
  "relative_to_easter",
  "weekday_on_or_after",
  "closest_weekday_to_date",
];

/**
 * Calendar Date RuleをJSON直接入力なしで編集します。
 * @param {Props} props - エディターの値と変更ハンドラー。
 * @returns {JSX.Element} Date Rule編集UI。
 */
export function AdminCalendarDateRuleEditor({ value, locale, disabled = false, onChange }: Props) {
  const t = getTranslation(locale).admin.calendar;
  return (
    <fieldset disabled={disabled} className="admin-calendar-date-rule">
      <legend>{t.dateRule}</legend>
      <label>
        {t.dateRuleType}
        <select
          value={value?.type ?? ""}
          onChange={(event) =>
            onChange(event.target.value ? createDefaultRule(event.target.value as DateRuleType) : null)
          }
        >
          <option value="">{t.notSet}</option>
          {(Object.keys(t.dateRuleTypes) as DateRuleType[]).map((type) => (
            <option key={type} value={type}>
              {t.dateRuleTypes[type]}
            </option>
          ))}
        </select>
      </label>
      {value ? renderRule(value, onChange, locale) : null}
    </fieldset>
  );
}

type DateRuleType = CalendarDateRuleDefinition["type"];

function renderRule(
  value: CalendarDateRuleDefinition,
  onChange: (value: CalendarDateRuleDefinition | null) => void,
  locale: Locale,
) {
  if (value.type === "rule_set") return <RuleSetEditor value={value} locale={locale} onChange={onChange} />;
  const t = getTranslation(locale).admin.calendar;
  if (value.type === "date_range") {
    return (
      <div className="admin-calendar-rule-grid">
        <MonthDayFields
          label={t.start}
          value={value.start}
          locale={locale}
          onChange={(next) => onChange({ ...value, start: next })}
        />
        <MonthDayFields
          label={t.end}
          value={value.end}
          locale={locale}
          onChange={(next) => onChange({ ...value, end: next })}
        />
      </div>
    );
  }
  if (value.type === "annual_variable") {
    return (
      <div className="admin-calendar-rule-grid">
        <MonthField
          value={value.usualMonth}
          locale={locale}
          onChange={(usualMonth) => onChange({ ...value, usualMonth })}
        />
        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={value.requiresOfficialConfirmation}
            onChange={(event) => onChange({ ...value, requiresOfficialConfirmation: event.target.checked })}
          />
          {t.requiresOfficialConfirmation}
        </label>
      </div>
    );
  }
  return <ConcreteRuleFields value={value} locale={locale} onChange={(next) => onChange(next)} />;
}

function RuleSetEditor({
  value,
  locale,
  onChange,
}: {
  value: RuleSetRule;
  locale: Locale;
  onChange: (value: CalendarDateRuleDefinition | null) => void;
}) {
  const t = getTranslation(locale).admin.calendar;
  const hasOtherwise = value.rules.some((rule) => rule.when.type === "otherwise");
  function update(index: number, item: RuleSetItem) {
    onChange({
      ...value,
      rules: value.rules.map((current, currentIndex) => (currentIndex === index ? item : current)),
    });
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.rules.length) return;
    const rules = [...value.rules];
    [rules[index], rules[target]] = [rules[target], rules[index]];
    onChange({ ...value, rules });
  }
  return (
    <div className="admin-calendar-rule-set">
      {value.rules.map((item, index) => (
        <article className="admin-calendar-rule-card" key={index}>
          <h3>{`${t.condition} ${index + 1}`}</h3>
          <div className="admin-calendar-rule-grid">
            <label>
              {t.condition}
              <select
                value={item.when.type}
                onChange={(event) =>
                  update(index, {
                    ...item,
                    when:
                      event.target.value === "otherwise"
                        ? { type: "otherwise" }
                        : { type: "fixed_date_weekday", month: 1, day: 1, weekday: "sunday" },
                  })
                }
              >
                <option value="fixed_date_weekday">{t.conditionDate}</option>
                <option value="otherwise" disabled={hasOtherwise && item.when.type !== "otherwise"}>
                  {t.otherwise}
                </option>
              </select>
            </label>
            {item.when.type === "fixed_date_weekday" ? (
              <MonthDayFields
                label={t.conditionDate}
                value={item.when}
                locale={locale}
                onChange={(next) =>
                  update(index, {
                    ...item,
                    when: {
                      ...next,
                      type: "fixed_date_weekday",
                      weekday: item.when.type === "fixed_date_weekday" ? item.when.weekday : "sunday",
                    },
                  })
                }
              />
            ) : null}
            {item.when.type === "fixed_date_weekday" ? (
              <WeekdayField
                value={item.when.type === "fixed_date_weekday" ? item.when.weekday : "sunday"}
                locale={locale}
                onChange={(weekday) =>
                  update(index, {
                    ...item,
                    when:
                      item.when.type === "fixed_date_weekday"
                        ? { ...item.when, weekday }
                        : { type: "fixed_date_weekday", month: 1, day: 1, weekday },
                  })
                }
              />
            ) : null}
            <label>
              {t.use}
              <select
                value={item.use.type}
                onChange={(event) =>
                  update(index, { ...item, use: createConcreteRule(event.target.value as ConcreteRule["type"]) })
                }
              >
                {CONCRETE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t.dateRuleTypes[type]}
                  </option>
                ))}
              </select>
            </label>
            <ConcreteRuleFields value={item.use} locale={locale} onChange={(use) => update(index, { ...item, use })} />
          </div>
          <div className="admin-calendar-rule-actions">
            <button
              type="button"
              className="admin-secondary-action"
              onClick={() => move(index, -1)}
              disabled={index === 0 || item.when.type === "otherwise"}
            >
              {t.moveUp}
            </button>
            <button
              type="button"
              className="admin-secondary-action"
              onClick={() => move(index, 1)}
              disabled={index === value.rules.length - 1 || value.rules[index + 1]?.when.type === "otherwise"}
            >
              {t.moveDown}
            </button>
            <button
              type="button"
              className="admin-secondary-action"
              onClick={() =>
                onChange({ ...value, rules: value.rules.filter((_, currentIndex) => currentIndex !== index) })
              }
              disabled={value.rules.length === 1}
            >
              {t.removeRule}
            </button>
          </div>
        </article>
      ))}
      <button
        type="button"
        className="admin-secondary-action"
        onClick={() => {
          const newRule: RuleSetItem = {
            when: { type: "fixed_date_weekday", month: 1, day: 1, weekday: "sunday" },
            use: createConcreteRule("fixed"),
          };
          const otherwiseIndex = value.rules.findIndex((rule) => rule.when.type === "otherwise");
          const rules =
            otherwiseIndex === -1
              ? [...value.rules, newRule]
              : [...value.rules.slice(0, otherwiseIndex), newRule, ...value.rules.slice(otherwiseIndex)];
          onChange({ ...value, rules });
        }}
      >
        {t.addRule}
      </button>
    </div>
  );
}

function ConcreteRuleFields({
  value,
  locale,
  onChange,
}: {
  value: ConcreteRule;
  locale: Locale;
  onChange: (value: ConcreteRule) => void;
}) {
  const t = getTranslation(locale).admin.calendar;
  if (value.type === "fixed") {
    return (
      <MonthDayFields
        label={t.dateRule}
        value={value}
        locale={locale}
        onChange={(next) => onChange({ ...value, ...next })}
      />
    );
  }
  if (value.type === "relative_to_easter") {
    return (
      <label>
        {t.offsetDays}
        <input
          type="number"
          value={value.offsetDays}
          onChange={(event) => onChange({ ...value, offsetDays: Number(event.target.value) })}
        />
      </label>
    );
  }
  if (value.type === "nth_weekday") {
    return (
      <div className="admin-calendar-rule-grid">
        <MonthField value={value.month} locale={locale} onChange={(month) => onChange({ ...value, month })} />
        <label>
          {t.nth}
          <input
            type="number"
            min={1}
            max={5}
            value={value.nth}
            onChange={(event) => onChange({ ...value, nth: Number(event.target.value) })}
          />
        </label>
        <WeekdayField value={value.weekday} locale={locale} onChange={(weekday) => onChange({ ...value, weekday })} />
      </div>
    );
  }
  if (value.type === "last_weekday") {
    return (
      <div className="admin-calendar-rule-grid">
        <MonthField value={value.month} locale={locale} onChange={(month) => onChange({ ...value, month })} />
        <WeekdayField value={value.weekday} locale={locale} onChange={(weekday) => onChange({ ...value, weekday })} />
      </div>
    );
  }
  return (
    <div className="admin-calendar-rule-grid">
      <MonthDayFields
        label={t.dateRule}
        value={value}
        locale={locale}
        onChange={(next) => onChange({ ...value, ...next })}
      />
      <WeekdayField value={value.weekday} locale={locale} onChange={(weekday) => onChange({ ...value, weekday })} />
    </div>
  );
}

function MonthDayFields({
  label,
  value,
  locale,
  onChange,
}: {
  label: string;
  value: Readonly<{ month: number; day: number }>;
  locale: Locale;
  onChange: (value: Readonly<{ month: number; day: number }>) => void;
}) {
  const t = getTranslation(locale).admin.calendar;
  return (
    <div className="admin-calendar-rule-grid">
      <label>
        {label} {t.month}
        <input
          type="number"
          min={1}
          max={12}
          value={value.month}
          onChange={(event) => onChange({ ...value, month: Number(event.target.value) })}
        />
      </label>
      <label>
        {label} {t.day}
        <input
          type="number"
          min={1}
          max={31}
          value={value.day}
          onChange={(event) => onChange({ ...value, day: Number(event.target.value) })}
        />
      </label>
    </div>
  );
}

function MonthField({ value, locale, onChange }: { value: number; locale: Locale; onChange: (value: number) => void }) {
  const t = getTranslation(locale).admin.calendar;
  return (
    <label>
      {t.month}
      <input type="number" min={1} max={12} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function WeekdayField({
  value,
  locale,
  onChange,
}: {
  value: CalendarWeekdayName;
  locale: Locale;
  onChange: (value: CalendarWeekdayName) => void;
}) {
  const t = getTranslation(locale).admin.calendar;
  return (
    <label>
      {t.weekday}
      <select value={value} onChange={(event) => onChange(event.target.value as CalendarWeekdayName)}>
        {WEEKDAYS.map((weekday) => (
          <option key={weekday} value={weekday}>
            {t.weekdays[weekday]}
          </option>
        ))}
      </select>
    </label>
  );
}

function createDefaultRule(type: DateRuleType): CalendarDateRuleDefinition {
  if (type === "date_range") return { type, start: { month: 1, day: 1 }, end: { month: 1, day: 2 } };
  if (type === "rule_set") return { type, rules: [{ when: { type: "otherwise" }, use: createConcreteRule("fixed") }] };
  if (type === "annual_variable") return { type, usualMonth: 1, requiresOfficialConfirmation: true };
  return createConcreteRule(type);
}

function createConcreteRule(type: ConcreteRule["type"]): ConcreteRule {
  if (type === "fixed") return { type, month: 1, day: 1 };
  if (type === "nth_weekday") return { type, month: 1, weekday: "monday", nth: 1 };
  if (type === "last_weekday") return { type, month: 1, weekday: "monday" };
  if (type === "relative_to_easter") return { type, offsetDays: 0 };
  return { type, month: 1, day: 1, weekday: "monday" };
}
