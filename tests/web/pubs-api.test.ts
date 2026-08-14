// 公開店舗APIのレスポンスと環境別APIキー認証を保証するテストです。
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../../apps/web/app/api/pubs/route";

const originalApiKey = process.env.IRISHPUB_MAP_API_KEY;
const originalVercelEnv = process.env.VERCEL_ENV;

function restoreEnvironmentVariable(name: "IRISHPUB_MAP_API_KEY" | "VERCEL_ENV", value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("GET /api/pubs", () => {
  afterEach(() => {
    restoreEnvironmentVariable("IRISHPUB_MAP_API_KEY", originalApiKey);
    restoreEnvironmentVariable("VERCEL_ENV", originalVercelEnv);
  });

  it("returns validated pubs locally when API key is not configured", async () => {
    delete process.env.IRISHPUB_MAP_API_KEY;
    delete process.env.VERCEL_ENV;

    const response = await GET(new Request("http://localhost/api/pubs"));
    const body = (await response.json()) as { pubs: unknown[] };

    expect(response.status).toBe(200);
    expect(body.pubs.length).toBeGreaterThan(0);
    expect(body.pubs[0]).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String) }));
  });

  it("returns a configuration error in Production when the API key is missing", async () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.IRISHPUB_MAP_API_KEY;

    const response = await GET(new Request("http://localhost/api/pubs", { headers: { "x-api-key": "test-only-api-key" } }));

    await expect(response.json()).resolves.toEqual({ error: "API authentication is not configured." });
    expect(response.status).toBe(503);
  });

  it("rejects Production requests with a missing or invalid API key", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.IRISHPUB_MAP_API_KEY = "test-only-api-key";

    const missingKeyResponse = await GET(new Request("http://localhost/api/pubs"));
    const invalidKeyResponse = await GET(
      new Request("http://localhost/api/pubs", { headers: { "x-api-key": "wrong-test-key" } })
    );

    await expect(missingKeyResponse.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(missingKeyResponse.status).toBe(401);
    expect(invalidKeyResponse.status).toBe(401);
  });

  it("returns pubs when the configured API key matches", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.IRISHPUB_MAP_API_KEY = "test-only-api-key";

    const response = await GET(new Request("http://localhost/api/pubs", { headers: { "x-api-key": "test-only-api-key" } }));
    const body = (await response.json()) as { pubs: unknown[] };

    expect(response.status).toBe(200);
    expect(body.pubs.length).toBeGreaterThan(0);
  });
});
