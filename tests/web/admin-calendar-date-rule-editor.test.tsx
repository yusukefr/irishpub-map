import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminCalendarDateRuleEditor } from "../../apps/web/app/components/admin-calendar-date-rule-editor";
import type { CalendarDateRuleDefinition } from "../../apps/web/app/lib/calendar/types";

const change = vi.fn();

function renderRule(value: CalendarDateRuleDefinition | null) {
  change.mockReset();
  return render(<AdminCalendarDateRuleEditor value={value} locale="ja" onChange={change} />);
}

describe("AdminCalendarDateRuleEditor", () => {
  it("renders each supported rule type and emits changes", () => {
    const rules: CalendarDateRuleDefinition[] = [
      { type: "fixed", month: 3, day: 17 },
      { type: "date_range", start: { month: 3, day: 1 }, end: { month: 4, day: 30 } },
      { type: "nth_weekday", month: 3, weekday: "monday", nth: 2 },
      { type: "last_weekday", month: 3, weekday: "friday" },
      { type: "relative_to_easter", offsetDays: 1 },
      { type: "weekday_on_or_after", month: 3, day: 15, weekday: "monday" },
      { type: "closest_weekday_to_date", month: 3, day: 17, weekday: "sunday" },
      { type: "annual_variable", usualMonth: 3, requiresOfficialConfirmation: true },
    ];
    for (const rule of rules) {
      const view = renderRule(rule);
      expect(screen.getByRole("combobox", { name: "日付ルールの種類" })).toHaveValue(rule.type);
      view.unmount();
    }
    const view = renderRule(null);
    fireEvent.change(screen.getByRole("combobox", { name: "日付ルールの種類" }), { target: { value: "fixed" } });
    expect(change).toHaveBeenCalledWith({ type: "fixed", month: 1, day: 1 });
    fireEvent.change(screen.getByRole("combobox", { name: "日付ルールの種類" }), { target: { value: "" } });
    for (const type of [
      "date_range",
      "nth_weekday",
      "last_weekday",
      "relative_to_easter",
      "weekday_on_or_after",
      "closest_weekday_to_date",
      "rule_set",
      "annual_variable",
    ] as const)
      fireEvent.change(screen.getByRole("combobox", { name: "日付ルールの種類" }), { target: { value: type } });
    view.unmount();
  });

  it("updates fixed, range, weekday, Easter, and annual fields", () => {
    const view = renderRule({ type: "date_range", start: { month: 3, day: 1 }, end: { month: 4, day: 30 } });
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "5" } });
    fireEvent.change(inputs[2], { target: { value: "6" } });
    expect(change).toHaveBeenCalled();
    view.unmount();

    const easter = renderRule({ type: "relative_to_easter", offsetDays: 1 });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "-2" } });
    expect(change).toHaveBeenCalledWith({ type: "relative_to_easter", offsetDays: -2 });
    easter.unmount();

    const annual = renderRule({ type: "annual_variable", usualMonth: 3, requiresOfficialConfirmation: false });
    fireEvent.click(screen.getByRole("checkbox", { name: "公式発表が必要" }));
    expect(change).toHaveBeenCalledWith({ type: "annual_variable", usualMonth: 3, requiresOfficialConfirmation: true });
    annual.unmount();
  });

  it("supports rule-set editing actions and disabled state", () => {
    const value: CalendarDateRuleDefinition = {
      type: "rule_set",
      rules: [
        {
          when: { type: "fixed_date_weekday", month: 3, day: 17, weekday: "sunday" },
          use: { type: "fixed", month: 3, day: 17 },
        },
        { when: { type: "otherwise" }, use: { type: "fixed", month: 4, day: 1 } },
      ],
    };
    const ruleSet = renderRule(value);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "ルールを追加" }));
    expect(change).toHaveBeenLastCalledWith({
      type: "rule_set",
      rules: [
        value.rules[0],
        {
          when: { type: "fixed_date_weekday", month: 1, day: 1, weekday: "sunday" },
          use: { type: "fixed", month: 1, day: 1 },
        },
        value.rules[1],
      ],
    });
    fireEvent.click(screen.getAllByRole("button", { name: "上へ" })[1]);
    fireEvent.click(screen.getAllByRole("button", { name: "下へ" })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "ルールを削除" })[0]);
    expect(change).toHaveBeenCalled();
    ruleSet.unmount();

    const noOtherwise: CalendarDateRuleDefinition = {
      type: "rule_set",
      rules: [
        {
          when: { type: "fixed_date_weekday", month: 3, day: 17, weekday: "sunday" },
          use: { type: "fixed", month: 3, day: 17 },
        },
      ],
    };
    const appendRuleSet = renderRule(noOtherwise);
    fireEvent.click(screen.getByRole("button", { name: "ルールを追加" }));
    expect(change).toHaveBeenLastCalledWith({
      type: "rule_set",
      rules: [
        noOtherwise.rules[0],
        {
          when: { type: "fixed_date_weekday", month: 1, day: 1, weekday: "sunday" },
          use: { type: "fixed", month: 1, day: 1 },
        },
      ],
    });
    appendRuleSet.unmount();

    const disabledChange = vi.fn();
    render(<AdminCalendarDateRuleEditor value={value} locale="ja" disabled onChange={disabledChange} />);
    expect(screen.getByRole("group", { name: "日付ルール" })).toBeDisabled();
  });
  it("edits concrete rule fields and both Rule Set condition branches", () => {
    const concreteRules: CalendarDateRuleDefinition[] = [
      { type: "fixed", month: 1, day: 1 },
      { type: "nth_weekday", month: 1, weekday: "sunday", nth: 1 },
      { type: "last_weekday", month: 1, weekday: "sunday" },
      { type: "relative_to_easter", offsetDays: 0 },
      { type: "weekday_on_or_after", month: 1, day: 1, weekday: "sunday" },
      { type: "closest_weekday_to_date", month: 1, day: 1, weekday: "sunday" },
    ];
    for (const rule of concreteRules) {
      const view = renderRule(rule);
      for (const input of screen.queryAllByRole("spinbutton")) fireEvent.change(input, { target: { value: "2" } });
      for (const select of screen.queryAllByRole("combobox"))
        fireEvent.change(select, {
          target: { value: select === screen.getByRole("combobox", { name: "日付ルールの種類" }) ? "fixed" : "monday" },
        });
      view.unmount();
    }

    const ruleSet: CalendarDateRuleDefinition = {
      type: "rule_set",
      rules: [
        {
          when: { type: "fixed_date_weekday", month: 1, day: 1, weekday: "sunday" },
          use: { type: "fixed", month: 1, day: 1 },
        },
        { when: { type: "otherwise" }, use: { type: "fixed", month: 1, day: 2 } },
      ],
    };
    const view = renderRule(ruleSet);
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "otherwise" } });
    fireEvent.change(selects[1], { target: { value: "fixed_date_weekday" } });
    fireEvent.change(selects[2], { target: { value: "monday" } });
    for (const type of [
      "fixed",
      "nth_weekday",
      "last_weekday",
      "relative_to_easter",
      "weekday_on_or_after",
      "closest_weekday_to_date",
    ] as const)
      fireEvent.change(selects[3], { target: { value: type } });
    view.unmount();
  });
});
