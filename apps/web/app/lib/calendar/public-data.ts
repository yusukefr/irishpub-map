import { revalidateTag, unstable_cache } from "next/cache";
import { getPublishedCalendarEvents } from "./repository";
import type { CalendarEvent } from "./types";

/** Public CalendarのPublished Event全体に付与するCache Tagです。 */
export const PUBLIC_CALENDAR_CACHE_TAG = "calendar:published-events";

const getCachedPublishedCalendarEvents = unstable_cache(getPublishedCalendarEvents, [PUBLIC_CALENDAR_CACHE_TAG], {
  tags: [PUBLIC_CALENDAR_CACHE_TAG],
  revalidate: false,
});

/** Published Calendar Event全体をCache経由で取得します。
 * @returns {Promise<readonly CalendarEvent[]>} 公開済みCalendar Event一覧。DB未設定時は空配列。
 */
export function getPublishedCalendarData(): Promise<readonly CalendarEvent[]> {
  return getCachedPublishedCalendarEvents();
}

/** Published Calendar EventのCacheを即時失効させます。
 * 後続の管理操作はこの関数だけを利用し、Cache Tagの詳細へ依存しません。
 * @returns {void}
 */
export function invalidatePublishedCalendarData(): void {
  revalidateTag(PUBLIC_CALENDAR_CACHE_TAG, { expire: 0 });
}
