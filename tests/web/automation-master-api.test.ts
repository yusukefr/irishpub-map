// Automation Master APIのScope、DB由来DTO、入力とlocale、内部エラー一般化を保証します。
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALE_COOKIE } from "../../apps/web/app/lib/i18n";

const masterMocks = vi.hoisted(() => ({
  getMunicipalitiesByPrefecture: vi.fn(),
  getPrefectures: vi.fn(),
  getPubStatuses: vi.fn(),
}));
const tagMocks = vi.hoisted(() => ({ getAdminTags: vi.fn() }));

vi.mock("../../apps/web/app/lib/master-repository", () => masterMocks);
vi.mock("../../apps/web/app/lib/tag-repository", () => tagMocks);

import { GET as getMunicipalities } from "../../apps/web/app/api/automation/v1/master/municipalities/route";
import { GET as getPrefectures } from "../../apps/web/app/api/automation/v1/master/prefectures/route";
import { GET as getStatuses } from "../../apps/web/app/api/automation/v1/master/statuses/route";
import { GET as getTags } from "../../apps/web/app/api/automation/v1/master/tags/route";

const token = "test-only-automation-token";
const originalHash = process.env.AUTOMATION_API_TOKEN_SHA256;
const originalScopes = process.env.AUTOMATION_API_SCOPES;
const routes = [
  ["/prefectures", getPrefectures],
  ["/municipalities?prefectureCode=23", getMunicipalities],
  ["/tags", getTags],
  ["/statuses", getStatuses],
] as const;

function request(path: string, bearer: string | null = token, headers: Record<string, string> = {}) {
  return new Request(`https://example.com/api/automation/v1/master${path}`, {
    headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...headers },
  });
}

beforeEach(() => {
  process.env.AUTOMATION_API_TOKEN_SHA256 = createHash("sha256").update(token).digest("hex");
  process.env.AUTOMATION_API_SCOPES = "master:read";
  for (const mock of [...Object.values(masterMocks), tagMocks.getAdminTags]) mock.mockReset();
});

afterEach(() => {
  if (originalHash === undefined) delete process.env.AUTOMATION_API_TOKEN_SHA256;
  else process.env.AUTOMATION_API_TOKEN_SHA256 = originalHash;
  if (originalScopes === undefined) delete process.env.AUTOMATION_API_SCOPES;
  else process.env.AUTOMATION_API_SCOPES = originalScopes;
});

describe("automation master APIs", () => {
  it("requires a valid Bearer Token and master:read on every route before repository access", async () => {
    for (const [path, handler] of routes) {
      for (const bearer of [null, "invalid"]) {
        const response = await handler(request(path, bearer));
        expect(response.status).toBe(401);
        expect(response.headers.get("www-authenticate")).toBe("Bearer");
        await expect(response.json()).resolves.toEqual({ errorCode: "unauthorized" });
      }
    }
    process.env.AUTOMATION_API_SCOPES = "tag:create";
    for (const [path, handler] of routes) {
      const response = await handler(request(path));
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ errorCode: "forbidden" });
    }
    for (const mock of [...Object.values(masterMocks), tagMocks.getAdminTags]) {
      expect(mock).not.toHaveBeenCalled();
    }
  });

  it("returns current master DTOs and locale translations from the existing repositories", async () => {
    const prefectures = [{ code: 23, name: "愛知県" }];
    const municipalities = [{ code: "231002", prefectureCode: 23, name: "Nagoya" }];
    const tags = [
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        key: "guinness",
        translations: { ja: "ギネス", en: "Guinness" },
        pubCount: 2,
      },
    ];
    const statuses = [{ code: 1, key: "open", name: "営業中" }];
    masterMocks.getPrefectures.mockResolvedValue(prefectures);
    masterMocks.getMunicipalitiesByPrefecture.mockResolvedValue(municipalities);
    tagMocks.getAdminTags.mockResolvedValue(tags);
    masterMocks.getPubStatuses.mockResolvedValue(statuses);

    await expect((await getPrefectures(request("/prefectures"))).json()).resolves.toEqual({ prefectures });
    await expect(
      (
        await getMunicipalities(request("/municipalities?prefectureCode=23", token, { cookie: `${LOCALE_COOKIE}=en` }))
      ).json(),
    ).resolves.toEqual({ municipalities });
    expect(masterMocks.getMunicipalitiesByPrefecture).toHaveBeenCalledWith(23, "en");
    await expect((await getTags(request("/tags"))).json()).resolves.toEqual({ tags });
    await expect((await getStatuses(request("/statuses"))).json()).resolves.toEqual({ statuses });
  });

  it("rejects invalid prefecture codes and hides repository errors", async () => {
    for (const query of ["", "0", "48", "023", "23x"]) {
      const response = await getMunicipalities(request(`/municipalities?prefectureCode=${query}`));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ errorCode: "invalid_prefecture_code" });
    }
    expect(masterMocks.getMunicipalitiesByPrefecture).not.toHaveBeenCalled();

    tagMocks.getAdminTags.mockRejectedValue(new Error("database connection detail"));
    const response = await getTags(request("/tags"));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ errorCode: "internal_error" });
  });
});
