// 公開店舗APIの匿名アクセス、locale検証、共有Cacheを保証するテストです。
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../../apps/web/app/api/pubs/route";

const originalVercelEnv = process.env.VERCEL_ENV;
const originalDatabaseUrl = process.env.DATABASE_URL;

function restoreEnvironmentVariable(name: "VERCEL_ENV" | "DATABASE_URL", value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("GET /api/pubs", () => {
  afterEach(() => {
    restoreEnvironmentVariable("VERCEL_ENV", originalVercelEnv);
    restoreEnvironmentVariable("DATABASE_URL", originalDatabaseUrl);
  });

  it("returns an empty list anonymously in Production when the database is not configured", async () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.DATABASE_URL;

    const response = await GET(new Request("http://localhost/api/pubs"));
    const body = (await response.json()) as { pubs: unknown[] };

    expect(response.status).toBe(200);
    expect(body).toEqual({ pubs: [] });
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  });

  it.each(["ja", "en"] as const)("accepts the %s locale anonymously", async (locale) => {
    delete process.env.DATABASE_URL;
    const response = await GET(new Request(`http://localhost/api/pubs?locale=${locale}`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ pubs: [] });
  });

  it("rejects an unsupported locale before querying the repository", async () => {
    delete process.env.DATABASE_URL;
    const response = await GET(new Request("http://localhost/api/pubs?locale=fr"));

    await expect(response.json()).resolves.toEqual({ error: "Unsupported locale." });
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBeNull();
  });
});
