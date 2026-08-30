import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, parseLocale, resolveLocale } from "../../apps/web/app/lib/i18n";

describe("i18n locale resolution", () => {
  it("derives the supported locale list from the shared definition", () => {
    expect(LOCALES).toEqual(["ja", "en"]);
    expect(DEFAULT_LOCALE).toBe("ja");
  });

  it.each([
    ["ja", "ja"],
    ["ja-JP", "ja"],
    ["en", "en"],
    ["en-US,en;q=0.9", "en"],
    ["en-GB", "en"],
  ])("parses %s as %s", (value, expected) => {
    expect(parseLocale(value)).toBe(expected);
  });

  it("returns undefined for an unsupported language and falls back to the default", () => {
    expect(parseLocale("ga-IE")).toBeUndefined();
    expect(resolveLocale({ cookieLocale: "ga", acceptLanguage: "fr" })).toBe(DEFAULT_LOCALE);
  });

  it("prioritizes a supported cookie over the browser language", () => {
    expect(resolveLocale({ cookieLocale: "en-GB", acceptLanguage: "ja-JP" })).toBe("en");
  });
});
