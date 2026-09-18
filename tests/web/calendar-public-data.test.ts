import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "../../apps/web/app/lib/calendar/types";

const mocks = vi.hoisted(() => ({
  getPublishedCalendarEvents: vi.fn(),
  isCalendarDatabaseConfigured: vi.fn(),
  revalidateTag: vi.fn(),
  unstableCache: vi.fn(),
  cachedQuery: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
  unstable_cache: (query: () => Promise<readonly CalendarEvent[]>, keyParts: string[], options: unknown) => {
    mocks.unstableCache(query, keyParts, options);
    return () => {
      mocks.cachedQuery();
      return query();
    };
  },
}));

vi.mock("../../apps/web/app/lib/calendar/repository", () => ({
  getPublishedCalendarEvents: mocks.getPublishedCalendarEvents,
  isCalendarDatabaseConfigured: mocks.isCalendarDatabaseConfigured,
}));

import {
  getPublishedCalendarData,
  invalidatePublishedCalendarData,
  PUBLIC_CALENDAR_CACHE_TAG,
} from "../../apps/web/app/lib/calendar/public-data";

const events: readonly CalendarEvent[] = [
  {
    id: "event-one",
    name: { ja: "イベント", en: "Event" },
    date: { type: "fixed", month: 3, day: 17 },
    category: "culture",
    isPublicHoliday: false,
    featured: false,
    description: { ja: "説明", en: "Description" },
  },
];

beforeEach(() => {
  mocks.getPublishedCalendarEvents.mockClear();
  mocks.isCalendarDatabaseConfigured.mockReset().mockReturnValue(true);
  mocks.revalidateTag.mockClear();
  mocks.cachedQuery.mockClear();
  mocks.getPublishedCalendarEvents.mockResolvedValue(events);
});

describe("calendar public data loader", () => {
  it("Published Event全体を固定Key・TagのCacheへ委譲する", async () => {
    await expect(getPublishedCalendarData()).resolves.toBe(events);

    expect(mocks.getPublishedCalendarEvents).toHaveBeenCalledOnce();
    expect(mocks.unstableCache).toHaveBeenCalledWith(expect.any(Function), [PUBLIC_CALENDAR_CACHE_TAG], {
      tags: [PUBLIC_CALENDAR_CACHE_TAG],
      revalidate: false,
    });
  });

  it("DATABASE_URL未設定時は空配列をCacheせず返す", async () => {
    mocks.isCalendarDatabaseConfigured.mockReturnValue(false);

    await expect(getPublishedCalendarData()).resolves.toEqual([]);

    expect(mocks.cachedQuery).not.toHaveBeenCalled();
    expect(mocks.getPublishedCalendarEvents).not.toHaveBeenCalled();
  });

  it("公開Calendar Cacheを即時失効させる", () => {
    invalidatePublishedCalendarData();

    expect(mocks.revalidateTag).toHaveBeenCalledWith(PUBLIC_CALENDAR_CACHE_TAG, { expire: 0 });
  });
});
