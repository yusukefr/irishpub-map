import { describe, expect, it, vi } from "vitest";

const cacheMocks = vi.hoisted(() => ({ revalidateTag: vi.fn(), unstableCache: vi.fn() }));
cacheMocks.unstableCache.mockImplementation((query: () => Promise<unknown>) => query);
vi.mock("next/cache", () => ({
  revalidateTag: cacheMocks.revalidateTag,
  unstable_cache: cacheMocks.unstableCache,
}));

import {
  getCachedPublishedQuizQuestions,
  invalidatePublicQuizCache,
  PUBLIC_QUIZ_CACHE_TAG,
} from "../../apps/web/app/lib/quiz/cache";

describe("public quiz cache", () => {
  it("localeをCache Keyに含め、Published一覧だけを5分Cacheする", async () => {
    const query = vi.fn().mockResolvedValue([]);

    await getCachedPublishedQuizQuestions("en", query);

    expect(cacheMocks.unstableCache).toHaveBeenCalledWith(query, ["public-quiz-questions", "en"], {
      tags: [PUBLIC_QUIZ_CACHE_TAG],
      revalidate: 300,
    });
  });

  it("Public Quiz Tagを即時失効させる", () => {
    invalidatePublicQuizCache();

    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith(PUBLIC_QUIZ_CACHE_TAG, { expire: 0 });
  });
});
