import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_MEDIA_PAGE_SIZE } from "@irishpub-map/shared/media";
import { listMediaAssets } from "../../apps/web/app/lib/media/repository";

const databaseMock = vi.hoisted(() => ({
  queries: [] as Array<{ text: string; values: unknown[] }>,
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@neondatabase/serverless", () => ({
  neon:
    () =>
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("?");
      databaseMock.queries.push({ text, values });
      return Promise.resolve(text.includes("COUNT(*)") ? [{ total: "1" }] : databaseMock.rows);
    },
}));

const originalDatabaseUrl = process.env.DATABASE_URL;
beforeEach(() => {
  process.env.DATABASE_URL = "postgres://test-only";
  databaseMock.queries = [];
  databaseMock.rows = [
    {
      id: "550e8400-e29b-41d4-a716-446655440001",
      url: "https://blob.example/asset.png",
      mime_type: "image/png",
      width: "8",
      height: "6",
      file_size: "42",
      created_at: "2026-09-24T00:00:00.000Z",
      storage_key: "private/internal-key.png",
    },
  ];
});
afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("media repository", () => {
  it("uses fixed-size pagination, stable ordering, and maps rows without storage keys", async () => {
    const result = await listMediaAssets(3);

    expect(result).toEqual({
      total: 1,
      page: 3,
      pageSize: ADMIN_MEDIA_PAGE_SIZE,
      media: [
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          url: "https://blob.example/asset.png",
          mimeType: "image/png",
          width: 8,
          height: 6,
          fileSize: 42,
          createdAt: "2026-09-24T00:00:00.000Z",
        },
      ],
    });
    const select = databaseMock.queries.find(({ text }) => text.includes("FROM media_assets ORDER BY"));
    expect(select?.text).toContain("ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?");
    expect(select?.values).toEqual([ADMIN_MEDIA_PAGE_SIZE, 2 * ADMIN_MEDIA_PAGE_SIZE]);
    expect(select?.text).not.toContain("storage_key");
    expect(result.media[0]).not.toHaveProperty("storageKey");
  });
});
