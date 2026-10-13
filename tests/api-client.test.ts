import { describe, expect, it, vi } from "vitest";
import { getPubs, PubApiHttpError, PubApiPayloadError } from "../packages/api-client/src";

const pub = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Example Pub",
  prefecture: "東京都",
  address: "東京都新宿区",
  latitude: 35.681,
  longitude: 139.767,
  websiteUrl: null,
  googleMapsUrl: null,
  instagramUrl: null,
  tags: ["guinness"],
  status: "open",
  pubType: "irish",
};

describe("public API client", () => {
  it.each(["ja", "en"] as const)("requests the canonical %s locale and validates pubs", async (locale) => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ pubs: [pub] }), { status: 200 }));

    await expect(getPubs({ baseUrl: "https://example.test/some/path", locale, fetch })).resolves.toEqual([pub]);
    expect(fetch).toHaveBeenCalledWith(new URL(`https://example.test/api/pubs?locale=${locale}`), {
      signal: undefined,
    });
  });

  it("forwards AbortSignal to the injected Fetch transport", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({ pubs: [] })));
    const controller = new AbortController();

    await getPubs({ baseUrl: "https://example.test", locale: "ja", signal: controller.signal, fetch });

    expect(fetch.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it("distinguishes a non-2xx response and does not retain its body", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response("private response contents", { status: 503 }));

    await expect(getPubs({ baseUrl: "https://example.test", locale: "ja", fetch })).rejects.toMatchObject({
      name: "PubApiHttpError",
      status: 503,
      message: "Public Pub API request failed with status 503.",
    });
    await expect(getPubs({ baseUrl: "https://example.test", locale: "ja", fetch })).rejects.not.toHaveProperty(
      "message",
      expect.stringContaining("private response contents"),
    );
  });

  it("reports invalid JSON as a payload error", async () => {
    const privateMarker = "SECRET-CUSTOMER-123";
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(`${privateMarker} not-json`));

    const error = await getPubs({ baseUrl: "https://example.test", locale: "ja", fetch }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(PubApiPayloadError);
    expect(error).not.toHaveProperty("cause");
    expect(String(error)).not.toContain(privateMarker);
    expect(JSON.stringify(error)).not.toContain(privateMarker);
    if (error instanceof Error) {
      const ownValues = Object.getOwnPropertyNames(error).map((key) => String(Reflect.get(error, key)));
      expect(ownValues.join(" ")).not.toContain(privateMarker);
    }
  });

  it("reports an invalid Pub schema as a payload error", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ pubs: [{ ...pub, latitude: "35" }] })));

    await expect(getPubs({ baseUrl: "https://example.test", locale: "ja", fetch })).rejects.toBeInstanceOf(
      PubApiPayloadError,
    );
  });

  it("rejects unknown Pub fields instead of returning them from the OpenAPI-constrained DTO", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ pubs: [{ ...pub, adminOnly: "unexpected-value" }] })));

    await expect(getPubs({ baseUrl: "https://example.test", locale: "ja", fetch })).rejects.toBeInstanceOf(
      PubApiPayloadError,
    );
  });

  it("rejects unknown fields in the response envelope", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ pubs: [], internal: "unexpected-value" })));

    await expect(getPubs({ baseUrl: "https://example.test", locale: "ja", fetch })).rejects.toBeInstanceOf(
      PubApiPayloadError,
    );
  });

  it("exposes distinct public error types", () => {
    expect(new PubApiHttpError(400)).toBeInstanceOf(Error);
    expect(new PubApiPayloadError("Invalid payload.")).toBeInstanceOf(Error);
  });
});
