// 公開店舗APIの匿名アクセス、公開DTO、Query制限、共有Cacheを保証するテストです。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Pub } from "@irishpub-map/shared/pub";
import { proxy } from "../../apps/web/proxy";
import { GET } from "../../apps/web/app/api/pubs/route";
import { getPublishedPubs } from "../../apps/web/app/lib/pub-repository";

const repositoryMock = vi.hoisted(() => ({ getPublishedPubs: vi.fn() }));

vi.mock("../../apps/web/app/lib/pub-repository", () => repositoryMock);

const getPublishedPubsMock = vi.mocked(getPublishedPubs);
const nonCanonicalQueries = [
  "?nonce=1",
  "?locale=ja&nonce=1",
  "?locale=ja&locale=en",
  "?locale=ja&",
  "?locale=ja&&&&",
  "?locale=%6a%61",
  "?%6cocale=ja",
  "?&&&&",
];

const originalVercelEnv = process.env.VERCEL_ENV;
const originalApiKey = process.env.IRISHPUB_MAP_API_KEY;

const publicPub = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Dubliners",
  prefecture: "東京都",
  address: "東京都新宿区",
  latitude: 35.6911443,
  longitude: 139.7025086,
  tags: ["guinness"],
  tagDisplayNames: { guinness: "Guinness" },
  status: "open",
  statusDisplayName: "Open",
  pubType: "irish",
  pubTypeDisplayName: "Irish Pub",
} satisfies Pub;

function restoreEnvironmentVariable(name: "VERCEL_ENV" | "IRISHPUB_MAP_API_KEY", value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("GET /api/pubs", () => {
  beforeEach(() => {
    getPublishedPubsMock.mockReset();
    getPublishedPubsMock.mockResolvedValue([]);
  });

  afterEach(() => {
    restoreEnvironmentVariable("VERCEL_ENV", originalVercelEnv);
    restoreEnvironmentVariable("IRISHPUB_MAP_API_KEY", originalApiKey);
  });

  it("returns an empty list anonymously in Production without API-key configuration", async () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.IRISHPUB_MAP_API_KEY;

    const response = await GET(new Request("http://localhost/api/pubs"));
    const body = (await response.json()) as { pubs: unknown[] };

    expect(response.status).toBe(200);
    expect(body).toEqual({ pubs: [] });
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, s-maxage=60, stale-while-revalidate=60");
  });

  it.each(["ja", "en"] as const)("accepts the %s locale anonymously", async (locale) => {
    getPublishedPubsMock.mockResolvedValue([publicPub]);
    const response = await GET(new Request(`http://localhost/api/pubs?locale=${locale}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ pubs: [publicPub] });
    expect(getPublishedPubsMock).toHaveBeenCalledWith(locale);
  });

  it("returns only the public Pub DTO without publication metadata", async () => {
    process.env.VERCEL_ENV = "production";
    getPublishedPubsMock.mockResolvedValue([publicPub]);

    const response = await GET(new Request("http://localhost/api/pubs?locale=en"));
    const body = (await response.json()) as { pubs: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(body.pubs).toEqual([publicPub]);
    expect(body.pubs[0]).not.toHaveProperty("isPublished");
    expect(body.pubs[0]).not.toHaveProperty("is_published");
    expect(body.pubs[0]).not.toHaveProperty("databaseUrl");
  });

  it("treats an empty query marker as the default locale", async () => {
    const request = new Request("http://localhost/api/pubs?");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getPublishedPubsMock).toHaveBeenCalledWith("ja");
  });

  it("rejects an unsupported locale before querying the repository", async () => {
    const response = await GET(new Request("http://localhost/api/pubs?locale=fr"));

    await expect(response.json()).resolves.toEqual({ error: "Unsupported locale." });
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBeNull();
    expect(getPublishedPubsMock).not.toHaveBeenCalled();
  });

  it.each(nonCanonicalQueries)("rejects query strings outside the canonical-locale allowlist (%s)", async (query) => {
    const response = await GET(new Request(`http://localhost/api/pubs${query}`));

    await expect(response.json()).resolves.toEqual({ error: "Unsupported query parameter." });
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBeNull();
    expect(getPublishedPubsMock).not.toHaveBeenCalled();
  });

  it.each(nonCanonicalQueries)("rejects non-canonical queries before CDN cache lookup (%s)", async (query) => {
    const response = proxy(new NextRequest(`http://localhost/api/pubs${query}`));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Unsupported query parameter." });
    expect(response.headers.get("Cache-Control")).toBeNull();
  });
});
