import { afterEach, describe, expect, it, vi } from "vitest";
import { formatAdminDate } from "../../apps/web/app/lib/admin-date-format";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("formatAdminDate", () => {
  it.each(["ja", "en"] as const)("%s表示を実行環境のタイムゾーンに依存させない", (locale) => {
    vi.stubEnv("TZ", "UTC");
    const utcResult = formatAdminDate("2026-01-15T12:00:00.000Z", locale);

    vi.stubEnv("TZ", "America/Los_Angeles");
    const pacificResult = formatAdminDate("2026-01-15T12:00:00.000Z", locale);

    expect(utcResult).toBe(pacificResult);
    expect(utcResult).toContain(locale === "ja" ? "21:00" : "9:00 PM");
  });
});
