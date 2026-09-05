import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pageMocks = vi.hoisted(() => ({ getRequestLocale: vi.fn() }));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: pageMocks.getRequestLocale }));

import CalendarPage, { generateMetadata } from "../../apps/web/app/(content)/discover/calendar/page";

let locale: "ja" | "en" = "ja";

type CalendarSearchParams = Record<string, string | string[] | undefined>;

async function renderCalendar(searchParams: CalendarSearchParams = {}) {
  render(await CalendarPage({ searchParams: Promise.resolve(searchParams) }));
}

beforeEach(() => {
  locale = "ja";
  pageMocks.getRequestLocale.mockReset().mockImplementation(() => Promise.resolve(locale));
  vi.useFakeTimers();
});

afterEach(() => vi.useRealTimers());

describe("Irish Calendar page", () => {
  it("日本語で当日複数件と月内イベントを表示する", async () => {
    vi.setSystemTime(new Date("2026-03-17T03:00:00Z"));
    await renderCalendar();

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
    await renderCalendar();

    expect(screen.getByRole("heading", { level: 1, name: "Irish Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Events in September 2026" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Browse monthly events" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← Previous month" })).toHaveAttribute(
      "href",
      "/discover/calendar?year=2026&month=8",
    );
    expect(screen.getByText("There are no events for today.")).toBeInTheDocument();
    expect(screen.getByText("There are no events for this month.")).toBeInTheDocument();
  });

  it("年次未確定イベントに具体日を表示しない", async () => {
    locale = "en";
    vi.setSystemTime(new Date("2026-05-20T03:00:00Z"));
    await renderCalendar();

    const heading = screen.getByRole("heading", { level: 3, name: "National Famine Commemoration" });
    const card = heading.closest("li");
    expect(card).toHaveTextContent("Date determined annually");
    expect(card).not.toHaveTextContent("May 1, 2026");
  });

  it("クエリで選択した月を表示し、今日の欄は実際の当日のままにする", async () => {
    vi.setSystemTime(new Date("2026-09-10T03:00:00Z"));
    await renderCalendar({ year: "2026", month: "3" });

    expect(screen.getByRole("heading", { level: 2, name: "2026年3月のイベント" })).toBeInTheDocument();
    expect(screen.getByText("今日に該当するイベントはありません。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "聖パトリックの日" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← 前月" })).toHaveAttribute(
      "href",
      "/discover/calendar?year=2026&month=2",
    );
    expect(screen.getByRole("link", { name: "次月 →" })).toHaveAttribute(
      "href",
      "/discover/calendar?year=2026&month=4",
    );
  });

  it("12月から翌年1月へ移動できるリンクを表示する", async () => {
    vi.setSystemTime(new Date("2026-09-10T03:00:00Z"));
    await renderCalendar({ year: "2026", month: "12" });

    expect(screen.getByRole("link", { name: "← 前月" })).toHaveAttribute(
      "href",
      "/discover/calendar?year=2026&month=11",
    );
    expect(screen.getByRole("link", { name: "次月 →" })).toHaveAttribute(
      "href",
      "/discover/calendar?year=2027&month=1",
    );
  });

  it("1月から前年12月へ移動できるリンクを表示する", async () => {
    vi.setSystemTime(new Date("2026-09-10T03:00:00Z"));
    await renderCalendar({ year: "2026", month: "1" });

    expect(screen.getByRole("link", { name: "← 前月" })).toHaveAttribute(
      "href",
      "/discover/calendar?year=2025&month=12",
    );
  });

  it("閲覧範囲の下限では前月を無効にしてリンクを生成しない", async () => {
    vi.setSystemTime(new Date("2026-09-10T03:00:00Z"));
    await renderCalendar({ year: "2025", month: "9" });

    expect(screen.queryByRole("link", { name: "← 前月" })).not.toBeInTheDocument();
    expect(screen.getByText("← 前月")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "次月 →" })).toHaveAttribute(
      "href",
      "/discover/calendar?year=2025&month=10",
    );
  });

  it("閲覧範囲の上限では次月を無効にしてリンクを生成しない", async () => {
    vi.setSystemTime(new Date("2026-09-10T03:00:00Z"));
    await renderCalendar({ year: "2027", month: "9" });

    expect(screen.getByRole("link", { name: "← 前月" })).toHaveAttribute(
      "href",
      "/discover/calendar?year=2027&month=8",
    );
    expect(screen.queryByRole("link", { name: "次月 →" })).not.toBeInTheDocument();
    expect(screen.getByText("次月 →")).toHaveAttribute("aria-disabled", "true");
  });

  it.each([
    ["年が数値でない", { year: "invalid", month: "9" }],
    ["月が0", { year: "2026", month: "0" }],
    ["月が13", { year: "2026", month: "13" }],
    ["年が巨大", { year: "9999999999999999", month: "9" }],
    ["閲覧範囲外", { year: "2027", month: "10" }],
    ["年が複数指定", { year: ["2026", "2027"], month: "9" }],
    ["年が未指定", { month: "9" }],
  ] satisfies ReadonlyArray<readonly [string, CalendarSearchParams]>)(
    "%sの場合は当月へフォールバックする",
    async (_label, searchParams) => {
      vi.setSystemTime(new Date("2026-09-10T03:00:00Z"));
      await renderCalendar(searchParams);

      expect(screen.getByRole("heading", { level: 2, name: "2026年9月のイベント" })).toBeInTheDocument();
      expect(screen.getByText("この月に該当するイベントはありません。")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "← 前月" })).toHaveAttribute(
        "href",
        "/discover/calendar?year=2026&month=8",
      );
      expect(screen.getByRole("link", { name: "次月 →" })).toHaveAttribute(
        "href",
        "/discover/calendar?year=2026&month=10",
      );
    },
  );

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
