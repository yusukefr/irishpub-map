import { describe, expect, it, vi } from "vitest";

const cacheMocks = vi.hoisted(() => ({ revalidateTag: vi.fn(), unstableCache: vi.fn() }));
cacheMocks.unstableCache.mockImplementation((query: () => Promise<unknown>) => query);
vi.mock("next/cache", () => ({
  revalidateTag: cacheMocks.revalidateTag,
  unstable_cache: cacheMocks.unstableCache,
}));

import {
  getCachedPublishedContent,
  getCachedPublishedContentList,
  getContentCacheTag,
  getContentListCacheTag,
  invalidateContentCache,
} from "../../apps/web/app/lib/content/cache";

describe("editorial content cache tags", () => {
  it("個別・一覧のlocaleをキャッシュキーに含め、既存タグを関連付ける", async () => {
    const detailQuery = vi.fn().mockResolvedValue({ slug: "pub-etiquette" });
    const listQuery = vi.fn().mockResolvedValue([]);

    await getCachedPublishedContent("guide", "pub-etiquette", "en", detailQuery);
    await getCachedPublishedContentList("guide", "ja", listQuery);

    expect(cacheMocks.unstableCache).toHaveBeenNthCalledWith(
      1,
      detailQuery,
      ["published-content", "guide", "pub-etiquette", "en"],
      { tags: ["content:guide:pub-etiquette"], revalidate: false },
    );
    expect(cacheMocks.unstableCache).toHaveBeenNthCalledWith(2, listQuery, ["published-content-list", "guide", "ja"], {
      tags: ["content:list:guide"],
      revalidate: false,
    });
  });

  it("invalidates the detail and list tags immediately", () => {
    expect(getContentCacheTag("guide", "pub-etiquette")).toBe("content:guide:pub-etiquette");
    expect(getContentListCacheTag("guide")).toBe("content:list:guide");

    invalidateContentCache("guide", "pub-etiquette");

    expect(cacheMocks.revalidateTag).toHaveBeenNthCalledWith(1, "content:guide:pub-etiquette", { expire: 0 });
    expect(cacheMocks.revalidateTag).toHaveBeenNthCalledWith(2, "content:list:guide", { expire: 0 });
  });
});
