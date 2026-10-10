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
      {
        query: (text: string, values: unknown[] = []) => {
          mocks.queries.push({ text, values });
          return Promise.resolve(mocks.responses.shift() ?? []);
        },
      },
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
  isCalendarDatabaseConfigured,
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
    id: "8acbc777-5160-4f1d-8284-6db05f89485d",
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
  it("E2E modeではDatabase URLが設定されていても全ReadをFixture境界で止める", async () => {
    process.env.E2E_TEST_MODE = "1";
    const id = "8acbc777-5160-4f1d-8284-6db05f89485d";

    expect(isCalendarDatabaseConfigured()).toBe(true);
    await expect(getPublishedCalendarEvents()).resolves.toEqual([]);
    await expect(listAdminCalendarEvents()).resolves.toEqual([]);
    await expect(getAdminCalendarEvent(id)).resolves.toBeNull();
    expect(mocks.queries).toEqual([]);
    expect(mocks.transactionCount).toBe(0);
  });

  it("公開済みだけを検証済みのCalendarEventとして返し、管理情報を公開しない", async () => {
    mocks.responses = [[publicRow()]];

    await expect(getPublishedCalendarEvents()).resolves.toEqual([
      {
        id: "8acbc777-5160-4f1d-8284-6db05f89485d",
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
    expect(mocks.queries[0].text).toContain("LEFT JOIN calendar_event_translations");
  });

  it.each([
    ["ja Translationなし", { name_ja: null }],
    ["en Translationなし", { name_en: null }],
    ["ja name空", { name_ja: "" }],
    ["en name空", { name_en: "" }],
  ])("Published Eventの%sを内部エラーとして扱う", async (_label, overrides) => {
    mocks.responses = [[publicRow(overrides)]];

    await expect(getPublishedCalendarEvents()).rejects.toThrow("Invalid calendar event returned from database.");
  });

  it("DB RowのAliasを正規化し、空Aliasと重複Aliasを拒否する", () => {
    expect(parsePublishedCalendarRow(publicRow({ aliases: [" Alias "] })).aliases).toEqual(["Alias"]);
    expect(() => parsePublishedCalendarRow(publicRow({ aliases: [""] }))).toThrow(
      "Invalid calendar event returned from database.",
    );
    expect(() => parsePublishedCalendarRow(publicRow({ aliases: ["Alias", " Alias "] }))).toThrow(
      "Invalid calendar event returned from database.",
    );
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
  it("UUIDで参照・更新・公開・削除できる", async () => {
    const id = "8acbc777-5160-4f1d-8284-6db05f89485d";
    mocks.responses = [[adminRow({ id })]];
    await expect(getAdminCalendarEvent(id)).resolves.toMatchObject({ id });

    mocks.responses = [[{ id, is_published: false }], [{ id }], [], []];
    await expect(updateCalendarEvent(id, writeInput)).resolves.toBe("updated");

    mocks.responses = [[{ id, is_published: false }], [{ id, is_published: true }]];
    await expect(setCalendarEventPublication(id, true)).resolves.toMatchObject({ id, isPublished: true });

    mocks.responses = [[{ id, is_published: false }]];
    await expect(deleteCalendarEvent(id)).resolves.toEqual({ id, wasPublished: false });
  });

  it("Draftを含む一覧と詳細を取得する", async () => {
    mocks.responses = [[adminRow()], [adminRow({ is_published: true })]];

    await expect(listAdminCalendarEvents()).resolves.toMatchObject([
      { id: "8acbc777-5160-4f1d-8284-6db05f89485d", isPublished: false, nameJa: "イベント", nameEn: "Event" },
    ]);
    await expect(getAdminCalendarEvent("8acbc777-5160-4f1d-8284-6db05f89485d")).resolves.toMatchObject({
      id: "8acbc777-5160-4f1d-8284-6db05f89485d",
      isPublished: true,
      translations: { ja: { name: "イベント", description: "説明" } },
    });
  });

  it("Application生成UUIDをEventと日英翻訳で共有し、同一transactionで作成する", async () => {
    const generatedId = "8acbc777-5160-4f1d-8284-6db05f89485d";
    mocks.responses = [[], [{ id: generatedId }]];

    await expect(insertCalendarEvent(generatedId, writeInput)).resolves.toBe(generatedId);

    expect(mocks.transactionCount).toBe(1);
    expect(mocks.queries).toHaveLength(2);
    expect(mocks.queries[0].text).toContain("LOCK TABLE calendar_events IN SHARE ROW EXCLUSIVE MODE");
    expect(mocks.queries[1].text).toContain("INSERT INTO calendar_events");
    expect(mocks.queries[1].text).toContain(
      "(id, category, date_rule, is_public_holiday, featured, aliases, source, sort_order)",
    );
    expect(mocks.queries[1].text).toContain("RETURNING id");
    expect(mocks.queries[1].text).toContain("INSERT INTO calendar_event_translations");
    expect(mocks.queries[1].text).toContain("SELECT inserted_event.id");
    expect(mocks.queries[1].text).toContain(
      "VALUES ('ja'::text, $8::text, $9::text), ('en'::text, $10::text, $11::text)",
    );
    expect(mocks.queries[1].text).toContain("COUNT(*) FROM inserted_translations");
    expect(mocks.queries[1].values).toContain(
      JSON.stringify({ type: "nth_weekday", month: 3, weekday: "monday", nth: 2 }),
    );
    expect(mocks.queries[1].values).toEqual([
      generatedId,
      "culture",
      JSON.stringify({ type: "nth_weekday", month: 3, weekday: "monday", nth: 2 }),
      false,
      true,
      ["Example"],
      "https://example.com/calendar",
      "イベント",
      "説明",
      "Event",
      "Description",
    ]);
  });

  it("Published Eventの不完全更新をtransaction内でブロックする", async () => {
    mocks.responses = [[{ id: "8acbc777-5160-4f1d-8284-6db05f89485d", is_published: true }], [], [], []];

    await expect(
      updateCalendarEvent("8acbc777-5160-4f1d-8284-6db05f89485d", { ...writeInput, category: null, dateRule: null }),
    ).resolves.toBe("publication_blocked");
    expect(mocks.transactionCount).toBe(1);
  });

  it("Draft Eventは公開要件未充足でも本体と翻訳を更新する", async () => {
    mocks.responses = [
      [{ id: "8acbc777-5160-4f1d-8284-6db05f89485d", is_published: false }],
      [{ id: "8acbc777-5160-4f1d-8284-6db05f89485d" }],
      [],
      [],
    ];

    await expect(
      updateCalendarEvent("8acbc777-5160-4f1d-8284-6db05f89485d", { ...writeInput, category: null, dateRule: null }),
    ).resolves.toBe("updated");
    expect(mocks.queries[2].text).toContain("event.is_published = FALSE");
    expect(mocks.queries[2].values).toContain(false);
  });

  it("公開状態変更、削除、E2E mutation拒否を行う", async () => {
    mocks.responses = [
      [{ id: "8acbc777-5160-4f1d-8284-6db05f89485d", is_published: false }],
      [{ id: "8acbc777-5160-4f1d-8284-6db05f89485d", is_published: true }],
    ];
    await expect(setCalendarEventPublication("8acbc777-5160-4f1d-8284-6db05f89485d", true)).resolves.toEqual({
      id: "8acbc777-5160-4f1d-8284-6db05f89485d",
      isPublished: true,
      unchanged: false,
    });

    mocks.responses = [[{ id: "8acbc777-5160-4f1d-8284-6db05f89485d", is_published: false }]];
    await expect(deleteCalendarEvent("8acbc777-5160-4f1d-8284-6db05f89485d")).resolves.toEqual({
      id: "8acbc777-5160-4f1d-8284-6db05f89485d",
      wasPublished: false,
    });

    process.env.E2E_TEST_MODE = "1";
    await expect(insertCalendarEvent("8acbc777-5160-4f1d-8284-6db05f89485d", writeInput)).rejects.toThrow(
      "Mutations are disabled in E2E test mode.",
    );
  });
});
