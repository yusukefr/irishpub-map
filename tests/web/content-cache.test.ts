import { describe, expect, it, vi } from "vitest";

const cacheMocks = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock("next/cache", () => cacheMocks);

import {
  getContentCacheTag,
  getContentListCacheTag,
  invalidateContentCache,
} from "../../apps/web/app/lib/content/cache";

describe("editorial content cache tags", () => {
  it("invalidates the detail and list tags immediately", () => {
    expect(getContentCacheTag("guide", "pub-etiquette")).toBe("content:guide:pub-etiquette");
    expect(getContentListCacheTag("guide")).toBe("content:list:guide");

    invalidateContentCache("guide", "pub-etiquette");

    expect(cacheMocks.revalidateTag).toHaveBeenNthCalledWith(1, "content:guide:pub-etiquette", { expire: 0 });
    expect(cacheMocks.revalidateTag).toHaveBeenNthCalledWith(2, "content:list:guide", { expire: 0 });
  });
});
