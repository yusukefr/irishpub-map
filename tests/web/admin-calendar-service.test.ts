import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  deleteCalendarEvent: vi.fn(),
  getAdminCalendarEvent: vi.fn(),
  getPublishedCalendarEvents: vi.fn(),
  insertCalendarEvent: vi.fn(),
  listAdminCalendarEvents: vi.fn(),
  setCalendarEventPublication: vi.fn(),
  updateCalendarEvent: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/calendar/repository", () => repositoryMocks);
const cacheMocks = vi.hoisted(() => ({ invalidatePublishedCalendarData: vi.fn() }));
vi.mock("../../apps/web/app/lib/calendar/public-data", () => cacheMocks);

import {
  AdminCalendarServiceError,
  changeAdminCalendarEventPublication,
  createAdminCalendarEvent,
  getCalendarPublicationMissingFields,
  readAdminCalendarList,
  removeAdminCalendarEvent,
  updateAdminCalendarEvent,
} from "../../apps/web/app/lib/admin-calendar-service";

const completeInput = {
  id: "event-one",
  category: "culture",
  dateRule: { type: "fixed", month: 3, day: 17 },
  isPublicHoliday: false,
  featured: true,
  aliases: [],
  source: null,
  translations: {
    ja: { name: "イベント", description: "説明" },
    en: { name: "Event", description: "Description" },
  },
};

const event = {
  ...completeInput,
  isPublished: false,
  createdAt: "2026-09-17T00:00:00.000Z",
  updatedAt: "2026-09-17T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  repositoryMocks.getAdminCalendarEvent.mockResolvedValue(event);
  repositoryMocks.listAdminCalendarEvents.mockResolvedValue([event]);
  repositoryMocks.setCalendarEventPublication.mockResolvedValue({
    id: "event-one",
    isPublished: true,
    unchanged: false,
  });
  repositoryMocks.updateCalendarEvent.mockResolvedValue("updated");
  repositoryMocks.deleteCalendarEvent.mockResolvedValue({ id: "event-one", wasPublished: true });
});

describe("admin calendar service", () => {
  it("安全な入力を正規化して作成し、一覧をRepositoryへ委譲する", async () => {
    await expect(createAdminCalendarEvent({ ...completeInput, source: "  " })).resolves.toMatchObject({
      id: "event-one",
    });
    expect(repositoryMocks.insertCalendarEvent).toHaveBeenCalledWith(
      "event-one",
      expect.objectContaining({ source: null }),
    );
    expect(repositoryMocks.insertCalendarEvent.mock.calls[0][1]).not.toHaveProperty("sortOrder");
    await expect(readAdminCalendarList()).resolves.toHaveLength(1);
  });

  it("不正ID、カテゴリ、日付ルールをvalidation errorへ変換する", async () => {
    for (const value of [
      { ...completeInput, id: "a".repeat(101) },
      { ...completeInput, id: " Event-One" },
      { ...completeInput, category: "unknown" },
      { ...completeInput, aliases: ["Alias", " Alias "] },
      { ...completeInput, dateRule: { type: "unknown" } },
    ]) {
      await expect(createAdminCalendarEvent(value)).rejects.toMatchObject({
        code: "validation",
      });
    }
  });

  it("Draft保存時もotherwiseの重複と途中配置を拒否する", async () => {
    const ruleSet = {
      type: "rule_set",
      rules: [
        { when: { type: "otherwise" }, use: { type: "fixed", month: 1, day: 1 } },
        {
          when: { type: "fixed_date_weekday", month: 1, day: 1, weekday: "sunday" },
          use: { type: "fixed", month: 1, day: 2 },
        },
      ],
    };
    await expect(createAdminCalendarEvent({ ...completeInput, dateRule: ruleSet })).rejects.toMatchObject({
      code: "validation",
      fieldErrors: { dateRule: "invalid_format" },
    });

    await expect(
      createAdminCalendarEvent({
        ...completeInput,
        dateRule: {
          type: "rule_set",
          rules: [
            {
              when: { type: "fixed_date_weekday", month: 1, day: 1, weekday: "sunday" },
              use: { type: "fixed", month: 1, day: 2 },
            },
            { when: { type: "otherwise" }, use: { type: "fixed", month: 1, day: 1 } },
            { when: { type: "otherwise" }, use: { type: "fixed", month: 1, day: 3 } },
          ],
        },
      }),
    ).rejects.toMatchObject({ code: "validation", fieldErrors: { dateRule: "invalid_format" } });
  });

  it("Draftは公開必須項目が空でも作成でき、型不正は拒否する", async () => {
    await expect(
      createAdminCalendarEvent({
        id: "draft-event",
        isPublicHoliday: false,
        featured: false,
        translations: { ja: {}, en: {} },
      }),
    ).resolves.toBe(event);
    await expect(createAdminCalendarEvent({ ...completeInput, featured: "yes" })).rejects.toMatchObject({
      fieldErrors: { featured: "invalid_type" },
    });
    await expect(createAdminCalendarEvent({ ...completeInput, isPublicHoliday: null })).rejects.toMatchObject({
      fieldErrors: { isPublicHoliday: "invalid_type" },
    });
  });

  it("公開不足項目を列挙し、Published更新を拒否する", async () => {
    const draft = {
      ...event,
      category: null,
      dateRule: null,
      translations: { ja: { name: "", description: "" }, en: { name: "", description: "" } },
    };
    expect(getCalendarPublicationMissingFields(draft)).toEqual([
      "category",
      "dateRule",
      "translations.ja.name",
      "translations.en.name",
    ]);
    repositoryMocks.updateCalendarEvent.mockResolvedValue("publication_blocked");
    repositoryMocks.getAdminCalendarEvent.mockResolvedValue({
      ...event,
      translations: { ja: { name: "イベント", description: "" }, en: { name: "Event", description: "" } },
    });
    await expect(changeAdminCalendarEventPublication("event-one", true)).resolves.toMatchObject({ isPublished: true });
    await expect(updateAdminCalendarEvent("event-one", draft)).rejects.toMatchObject({
      code: "publication_requirements_not_met",
    });
  });

  it("公開切替、競合、未存在を業務エラーへ変換する", async () => {
    await expect(changeAdminCalendarEventPublication("event-one", true)).resolves.toMatchObject({
      isPublished: true,
    });
    repositoryMocks.insertCalendarEvent.mockRejectedValue({ code: "23505" });
    await expect(createAdminCalendarEvent(completeInput)).rejects.toMatchObject({
      code: "conflict",
    });
    repositoryMocks.deleteCalendarEvent.mockResolvedValue(null);
    await expect(removeAdminCalendarEvent("event-one")).rejects.toBeInstanceOf(AdminCalendarServiceError);
  });

  it("Publishedに影響する操作だけPublic Calendar Cacheをinvalidateする", async () => {
    await changeAdminCalendarEventPublication("event-one", true);
    expect(cacheMocks.invalidatePublishedCalendarData).toHaveBeenCalledOnce();

    cacheMocks.invalidatePublishedCalendarData.mockClear();
    repositoryMocks.getAdminCalendarEvent.mockResolvedValue({ ...event, isPublished: true });
    await updateAdminCalendarEvent("event-one", completeInput);
    expect(cacheMocks.invalidatePublishedCalendarData).toHaveBeenCalledOnce();

    cacheMocks.invalidatePublishedCalendarData.mockClear();
    repositoryMocks.deleteCalendarEvent.mockResolvedValue({ id: "event-one", wasPublished: false });
    await removeAdminCalendarEvent("event-one");
    expect(cacheMocks.invalidatePublishedCalendarData).not.toHaveBeenCalled();
  });

  it("公開時に400年周期で解決できないDate Ruleを拒否する", async () => {
    repositoryMocks.getAdminCalendarEvent.mockResolvedValue({
      ...event,
      dateRule: { type: "fixed", month: 2, day: 29 },
    });

    await expect(changeAdminCalendarEventPublication("event-one", true)).rejects.toMatchObject({
      code: "publication_requirements_not_met",
      fieldErrors: { dateRule: "invalid_format" },
    });
    expect(repositoryMocks.setCalendarEventPublication).not.toHaveBeenCalled();
  });

  it("削除結果のwasPublishedをServiceから返す", async () => {
    repositoryMocks.deleteCalendarEvent.mockResolvedValue({ id: "event-one", wasPublished: true });

    await expect(removeAdminCalendarEvent("event-one")).resolves.toEqual({ id: "event-one", wasPublished: true });
  });
});
