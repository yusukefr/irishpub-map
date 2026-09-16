import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminCalendarWriteInput } from "../../apps/web/app/lib/calendar/types";

const mocks = vi.hoisted(() => ({
  queries: [] as Array<{ text: string; values: unknown[] }>,
  responses: [] as Array<Array<Record<string, unknown>>>,
  transactionCount: 0,
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const record = (strings: TemplateStringsArray, values: unknown[]) => {
      mocks.queries.push({ text: Array.from(strings).join("?"), values });
      return Promise.resolve(mocks.responses.shift() ?? []);
    };
    const transaction = Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]) => record(strings, values),
      {},
    );
    const query = Object.assign((_strings: TemplateStringsArray, ..._values: unknown[]) => Promise.resolve([]), {
      query: (text: string, values: unknown[] = []) => {
        mocks.queries.push({ text, values });
        return Promise.resolve(mocks.responses.shift() ?? []);
      },
      transaction: async (callback: (value: typeof transaction) => Promise<unknown>[]) => {
        mocks.transactionCount += 1;
        return Promise.all(callback(transaction));
      },
    });
    return query;
  },
}));

import {
  deleteCalendarEvent,
  getAdminCalendarEvent,
  getPublishedCalendarEvents,
  insertCalendarEvent,
  listAdminCalendarEvents,
  parsePublishedCalendarRow,
  setCalendarEventPublication,
  updateCalendarEvent,
} from "../../apps/web/app/lib/calendar/repository";

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalE2ETestMode = process.env.E2E_TEST_MODE;

const writeInput: AdminCalendarWriteInput = {
  category: "culture",
  dateRule: { type: "nth_weekday", month: 3, weekday: "monday", nth: 2 },
  isPublicHoliday: false,
  featured: true,
  aliases: ["Example"],
  source: "https://example.com/calendar",
  translations: {
    ja: { name: "イベント", description: "説明" },
    en: { name: "Event", description: "Description" },
  },
};

function publicRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-one",
    category: "culture",
    date_rule: { type: "fixed", month: 3, day: 17 },
    is_public_holiday: false,
    featured: true,
    aliases: ["St Patrick"],
    source: "https://example.com",
    name_ja: "イベント",
    description_ja: "説明",
    name_en: "Event",
    description_en: "Description",
    ...overrides,
  };
}

function adminRow(overrides: Record<string, unknown> = {}) {
  return {
    ...publicRow(),
    sort_order: 4,
    is_published: false,
    created_at: "2026-09-17T00:00:00.000Z",
    updated_at: "2026-09-17T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test-only";
  delete process.env.E2E_TEST_MODE;
  mocks.queries = [];
  mocks.responses = [];
  mocks.transactionCount = 0;
});

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalE2ETestMode === undefined) delete process.env.E2E_TEST_MODE;
  else process.env.E2E_TEST_MODE = originalE2ETestMode;
});

describe("calendar public repository", () => {
  it("公開済みだけを検証済みのCalendarEventとして返し、管理情報を公開しない", async () => {
    mocks.responses = [[publicRow()]];

    await expect(getPublishedCalendarEvents()).resolves.toEqual([
      {
        id: "event-one",
        name: { ja: "イベント", en: "Event" },
        date: { type: "fixed", month: 3, day: 17 },
        category: "culture",
        isPublicHoliday: false,
        featured: true,
        description: { ja: "説明", en: "Description" },
        aliases: ["St Patrick"],
        source: "https://example.com",
      },
    ]);
    expect(mocks.queries[0].text).toContain("is_published = TRUE");
  });

  it("不正なDB行や未対応日付ルールを公開DTOへ変換しない", () => {
    expect(() => parsePublishedCalendarRow(publicRow({ id: "Event-One" }))).toThrow(
      "Invalid calendar event returned from database.",
    );
    expect(() => parsePublishedCalendarRow(publicRow({ date_rule: { type: "unknown" } }))).toThrow(
      "Invalid calendar event returned from database.",
    );
  });
});

describe("calendar admin repository", () => {
  it("Draftを含む一覧と詳細を取得する", async () => {
    mocks.responses = [[adminRow()], [adminRow({ is_published: true })]];

    await expect(listAdminCalendarEvents()).resolves.toMatchObject([
      { id: "event-one", isPublished: false, nameJa: "イベント", nameEn: "Event" },
    ]);
    await expect(getAdminCalendarEvent("event-one")).resolves.toMatchObject({
      id: "event-one",
      isPublished: true,
      translations: { ja: { name: "イベント", description: "説明" } },
    });
  });

  it("Eventと日英翻訳を同一transactionで作成し、曜日をDB用JSONへ変換する", async () => {
    mocks.responses = [[], [], [], []];

    await insertCalendarEvent("event-one", writeInput);

    expect(mocks.transactionCount).toBe(1);
    expect(mocks.queries).toHaveLength(4);
    expect(mocks.queries[1].text).toContain("INSERT INTO calendar_events");
    expect(mocks.queries[1].values).toContain(
      JSON.stringify({ type: "nth_weekday", month: 3, weekday: "monday", nth: 2 }),
    );
    expect(mocks.queries[2].text).toContain("calendar_event_translations");
    expect(mocks.queries[3].values).toContain("en");
  });

  it("Published Eventの不完全更新をtransaction内でブロックする", async () => {
    mocks.responses = [[{ id: "event-one", is_published: true }], [], [], []];

    await expect(updateCalendarEvent("event-one", { ...writeInput, category: null, dateRule: null })).resolves.toBe(
      "publication_blocked",
    );
    expect(mocks.transactionCount).toBe(1);
  });

  it("公開状態変更、削除、E2E mutation拒否を行う", async () => {
    mocks.responses = [[{ id: "event-one", is_published: false }], [{ id: "event-one", is_published: true }]];
    await expect(setCalendarEventPublication("event-one", true)).resolves.toEqual({
      id: "event-one",
      isPublished: true,
      unchanged: false,
    });

    mocks.responses = [[{ id: "event-one", is_published: false }]];
    await expect(deleteCalendarEvent("event-one")).resolves.toEqual({ id: "event-one", wasPublished: false });

    process.env.E2E_TEST_MODE = "1";
    await expect(insertCalendarEvent("event-one", writeInput)).rejects.toThrow(
      "Mutations are disabled in E2E test mode.",
    );
  });
});
