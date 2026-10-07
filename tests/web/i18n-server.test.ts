import { describe, expect, it, vi } from "vitest";
import { resolveRequestLocale } from "../../apps/web/app/lib/i18n";
import { getRequestLocale } from "../../apps/web/app/lib/i18n/server";

const requestLanguage = vi.hoisted(() => ({ cookie: undefined as string | undefined, acceptLanguage: "" }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (requestLanguage.cookie ? { value: requestLanguage.cookie } : undefined) }),
  headers: async () => ({ get: () => requestLanguage.acceptLanguage }),
}));

describe("Server Component locale resolution", () => {
  it.each([
    [undefined, "fr-FR,en-US;q=0.9,ja;q=0.8", "en"],
    ["ja", "en-US,en;q=0.9", "ja"],
    ["fr", "ko-KR,ja-JP;q=0.9,en;q=0.8", "ja"],
  ])("matches Route Handler resolution for cookie %s and header %s", async (cookie, acceptLanguage, expected) => {
    requestLanguage.cookie = cookie;
    requestLanguage.acceptLanguage = acceptLanguage;
    const request = new Request("https://example.test/api/pubs", {
      headers: { ...(cookie && { cookie: `irishpub-map-locale=${cookie}` }), "accept-language": acceptLanguage },
    });

    expect(await getRequestLocale()).toBe(expected);
    expect(resolveRequestLocale(request)).toBe(expected);
  });
});
