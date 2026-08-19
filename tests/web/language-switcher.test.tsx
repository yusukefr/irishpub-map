import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageSwitcher } from "../../apps/web/app/components/language-switcher";

describe("LanguageSwitcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.cookie = "irishpub-map-locale=; Path=/; Max-Age=0";
  });

  it("shows the current language and available languages", async () => {
    render(<LanguageSwitcher locale="en" />);

    const trigger = screen.getByRole("button", { name: "Language: English" });
    expect(trigger).toHaveTextContent("🇬🇧LANGUAGE");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    const englishOption = screen.getByRole("menuitemradio", { name: "English" });
    expect(screen.getByRole("menuitemradio", { name: "日本語" })).toBeInTheDocument();
    expect(englishOption).toHaveAttribute("aria-checked", "true");
    expect(englishOption).toHaveAttribute("aria-current", "true");
    await waitFor(() => expect(englishOption).toHaveFocus());
  });

  it("stores a newly selected locale before reloading", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
    render(<LanguageSwitcher locale="ja" />);

    fireEvent.click(screen.getByRole("button", { name: "表示言語: 日本語" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "English" }));

    expect(document.cookie).toContain("irishpub-map-locale=en");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("closes and restores focus without reloading when the current locale is selected", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
    render(<LanguageSwitcher locale="ja" />);

    const trigger = screen.getByRole("button", { name: "表示言語: 日本語" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "日本語" }));

    expect(reload).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes the menu on Escape and restores focus", () => {
    render(<LanguageSwitcher locale="ja" />);
    const trigger = screen.getByRole("button", { name: "表示言語: 日本語" });
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes the menu when the user clicks outside", () => {
    render(<LanguageSwitcher locale="ja" />);
    fireEvent.click(screen.getByRole("button", { name: "表示言語: 日本語" }));

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the menu when focus moves outside", () => {
    render(
      <div>
        <LanguageSwitcher locale="ja" />
        <button type="button">Outside</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "表示言語: 日本語" }));

    fireEvent.focusIn(screen.getByRole("button", { name: "Outside" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("moves through language options with arrow keys", async () => {
    render(<LanguageSwitcher locale="ja" />);
    fireEvent.click(screen.getByRole("button", { name: "表示言語: 日本語" }));
    const japaneseOption = screen.getByRole("menuitemradio", { name: "日本語" });
    const englishOption = screen.getByRole("menuitemradio", { name: "English" });
    await waitFor(() => expect(japaneseOption).toHaveFocus());

    fireEvent.keyDown(japaneseOption, { key: "ArrowDown" });
    expect(englishOption).toHaveFocus();

    fireEvent.keyDown(englishOption, { key: "ArrowDown" });
    expect(japaneseOption).toHaveFocus();

    fireEvent.keyDown(japaneseOption, { key: "End" });
    expect(englishOption).toHaveFocus();

    fireEvent.keyDown(englishOption, { key: "Home" });
    expect(japaneseOption).toHaveFocus();

    fireEvent.keyDown(japaneseOption, { key: "ArrowUp" });
    expect(englishOption).toHaveFocus();
  });

  it("opens from the trigger with ArrowUp and focuses the last language", () => {
    render(<LanguageSwitcher locale="ja" />);
    const trigger = screen.getByRole("button", { name: "表示言語: 日本語" });

    fireEvent.keyDown(trigger, { key: "ArrowUp" });

    expect(screen.getByRole("menuitemradio", { name: "English" })).toHaveFocus();
  });

  it("opens from the trigger with ArrowDown and focuses the first language", () => {
    render(<LanguageSwitcher locale="en" />);
    const trigger = screen.getByRole("button", { name: "Language: English" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.getByRole("menuitemradio", { name: "日本語" })).toHaveFocus();
  });

  it("allows Tab to leave the menu after ArrowDown opens it in English", () => {
    render(
      <div>
        <LanguageSwitcher locale="en" />
        <button type="button">Outside</button>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "Language: English" });
    const outside = screen.getByRole("button", { name: "Outside" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const japaneseOption = screen.getByRole("menuitemradio", { name: "日本語" });
    expect(japaneseOption).toHaveFocus();
    for (const option of screen.getAllByRole("menuitemradio")) {
      expect(option).toHaveAttribute("tabindex", "-1");
    }

    expect(fireEvent.keyDown(japaneseOption, { key: "Tab" })).toBe(true);
    act(() => outside.focus());

    expect(outside).toHaveFocus();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("toggles the menu from the trigger", () => {
    render(<LanguageSwitcher locale="ja" />);
    const trigger = screen.getByRole("button", { name: "表示言語: 日本語" });

    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
