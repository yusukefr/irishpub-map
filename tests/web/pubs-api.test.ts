import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../../apps/web/app/api/pubs/route";

const originalApiKey = process.env.IRISHPUB_MAP_API_KEY;

describe("GET /api/pubs", () => {
  afterEach(() => {
    process.env.IRISHPUB_MAP_API_KEY = originalApiKey;
  });

  it("returns validated pubs when API key is not configured", async () => {
    delete process.env.IRISHPUB_MAP_API_KEY;

    const response = await GET(new Request("http://localhost/api/pubs"));
    const body = (await response.json()) as { pubs: unknown[] };

    expect(response.status).toBe(200);
    expect(body.pubs.length).toBeGreaterThan(0);
    expect(body.pubs[0]).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String) }));
  });

  it("rejects requests with a missing or invalid API key when configured", async () => {
    process.env.IRISHPUB_MAP_API_KEY = "secret";

    const missingKeyResponse = await GET(new Request("http://localhost/api/pubs"));
    const invalidKeyResponse = await GET(
      new Request("http://localhost/api/pubs", { headers: { "x-api-key": "wrong" } })
    );

    await expect(missingKeyResponse.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(missingKeyResponse.status).toBe(401);
    expect(invalidKeyResponse.status).toBe(401);
  });

  it("returns pubs when the configured API key matches", async () => {
    process.env.IRISHPUB_MAP_API_KEY = "secret";

    const response = await GET(new Request("http://localhost/api/pubs", { headers: { "x-api-key": "secret" } }));
    const body = (await response.json()) as { pubs: unknown[] };

    expect(response.status).toBe(200);
    expect(body.pubs.length).toBeGreaterThan(0);
  });
});
