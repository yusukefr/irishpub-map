import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageSwitcher } from "../../apps/web/app/components/language-switcher";

describe("LanguageSwitcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.cookie = "irishpub-map-locale=; Path=/; Max-Age=0";
  });

  it("shows the available languages in the current locale", () => {
    render(<LanguageSwitcher locale="en" />);

    expect(screen.getByLabelText("Language")).toHaveValue("en");
    expect(screen.getByRole("option", { name: "日本語" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
  });

  it("stores a newly selected locale before reloading", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
    render(<LanguageSwitcher locale="ja" />);

    fireEvent.change(screen.getByLabelText("表示言語"), { target: { value: "en" } });

    expect(document.cookie).toContain("irishpub-map-locale=en");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reload when the current locale is selected", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
    render(<LanguageSwitcher locale="ja" />);

    fireEvent.change(screen.getByLabelText("表示言語"), { target: { value: "ja" } });

    expect(reload).not.toHaveBeenCalled();
  });
});
