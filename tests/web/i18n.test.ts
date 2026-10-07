import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALES,
  parseAcceptLanguage,
  parseLocale,
  resolveLocale,
  resolveRequestLocale,
} from "../../apps/web/app/lib/i18n";

describe("i18n locale resolution", () => {
  it("derives the supported locale list from the shared definition", () => {
    expect(LOCALES).toEqual(["ja", "en"]);
    expect(DEFAULT_LOCALE).toBe("ja");
  });

  it.each([
    ["ja", "ja"],
    ["ja-JP", "ja"],
    ["en", "en"],
    ["en-US", "en"],
    ["en-GB", "en"],
  ])("parses %s as %s", (value, expected) => {
    expect(parseLocale(value)).toBe(expected);
  });

  it("returns undefined for an unsupported language and falls back to the default", () => {
    expect(parseLocale("ga-IE")).toBeUndefined();
    expect(parseLocale("en-US,en;q=0.9")).toBeUndefined();
    expect(resolveLocale({ cookieLocale: "ga", acceptLanguage: "fr" })).toBe(DEFAULT_LOCALE);
  });

  it.each([
    ["en-US,en;q=0.9", "en"],
    ["ja-JP,ja;q=0.9", "ja"],
    ["fr-FR,en-US;q=0.9,ja;q=0.8", "en"],
    ["ko-KR,ja-JP;q=0.9,en;q=0.8", "ja"],
    ["en;q=0.5,ja;q=1.0", "ja"],
    ["en;q=0,ja;q=0.5", "ja"],
    ["en;q=0.8,ja;q=0.8", "en"],
    ["ja;q=0.8,en;q=0.8", "ja"],
    ["en;q=invalid,ja;q=0.5", "ja"],
    ["en;q=1.1,ja;q=0.5", "ja"],
    ["fr-FR,de-DE;q=0.9", undefined],
    ["en;q=0", undefined],
  ])("parses Accept-Language %s as %s", (value, expected) => {
    expect(parseAcceptLanguage(value)).toBe(expected);
  });

  it("prioritizes a supported cookie over the browser language", () => {
    expect(resolveLocale({ cookieLocale: "en-GB", acceptLanguage: "ja-JP" })).toBe("en");
    expect(resolveLocale({ cookieLocale: "ja", acceptLanguage: "en-US,en;q=0.9" })).toBe("ja");
    expect(resolveLocale({ cookieLocale: "fr", acceptLanguage: "fr-FR,en-US;q=0.9" })).toBe("en");
    expect(resolveLocale({ acceptLanguage: "fr-FR,de-DE;q=0.9" })).toBe(DEFAULT_LOCALE);
  });

  it("uses the same resolution for a Route Handler request", () => {
    const request = new Request("https://example.test/api/pubs", {
      headers: { cookie: "irishpub-map-locale=fr", "accept-language": "fr-FR,en-US;q=0.9,ja;q=0.8" },
    });

    expect(resolveRequestLocale(request)).toBe(
      resolveLocale({ cookieLocale: "fr", acceptLanguage: "fr-FR,en-US;q=0.9,ja;q=0.8" }),
    );
  });
});
