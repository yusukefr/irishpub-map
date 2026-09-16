import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  deleteCalendarEvent: vi.fn(),
  getAdminCalendarEvent: vi.fn(),
  insertCalendarEvent: vi.fn(),
  listAdminCalendarEvents: vi.fn(),
  setCalendarEventPublication: vi.fn(),
  updateCalendarEvent: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/calendar/repository", () => repositoryMocks);

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
  repositoryMocks.deleteCalendarEvent.mockResolvedValue(true);
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
});
