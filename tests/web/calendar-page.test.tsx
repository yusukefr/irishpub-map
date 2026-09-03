import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pageMocks = vi.hoisted(() => ({ getRequestLocale: vi.fn() }));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: pageMocks.getRequestLocale }));

import CalendarPage, { generateMetadata } from "../../apps/web/app/(content)/discover/calendar/page";

let locale: "ja" | "en" = "ja";

beforeEach(() => {
  locale = "ja";
  pageMocks.getRequestLocale.mockReset().mockImplementation(() => Promise.resolve(locale));
  vi.useFakeTimers();
});

afterEach(() => vi.useRealTimers());

describe("Irish Calendar page", () => {
  it("日本語で当日複数件と月内イベントを表示する", async () => {
    vi.setSystemTime(new Date("2026-03-17T03:00:00Z"));
    render(await CalendarPage());

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "アイルランドのカレンダー" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "今日のアイルランド" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3, name: "アイルランド語週間" })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { level: 3, name: "聖パトリックの日" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "← Explore Irelandへ戻る" })).toHaveAttribute("href", "/discover");
  });

  it("英語表示と当日0件を明示する", async () => {
    locale = "en";
    vi.setSystemTime(new Date("2026-09-10T03:00:00Z"));
    render(await CalendarPage());

    expect(screen.getByRole("heading", { level: 1, name: "Irish Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Events in September 2026" })).toBeInTheDocument();
    expect(screen.getByText("There are no events for today.")).toBeInTheDocument();
    expect(screen.getByText("There are no events for this month.")).toBeInTheDocument();
  });

  it("年次未確定イベントに具体日を表示しない", async () => {
    locale = "en";
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    render(await CalendarPage());

    const heading = screen.getByRole("heading", { level: 3, name: "National Famine Commemoration" });
    const card = heading.closest("li");
    expect(card).toHaveTextContent("Date determined annually");
    expect(card).not.toHaveTextContent("May 1, 2026");
  });

  it("Locale別metadataを生成する", async () => {
    await expect(generateMetadata()).resolves.toEqual({
      title: "アイルランドのカレンダー | Irish Pub Map",
      description: "アイルランド共和国の祝日と、文化や歴史にまつわる日を紹介します。",
    });
    locale = "en";
    await expect(generateMetadata()).resolves.toEqual({
      title: "Irish Calendar | Irish Pub Map",
      description: "Explore public holidays and dates connected with Ireland's culture and history.",
    });
  });
});
