// 管理マスタAPIの認証、最小DTO、不正入力、内部エラーの一般化を保証します。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "../../apps/web/app/lib/admin-auth";

const repositoryMocks = vi.hoisted(() => ({
  getMunicipalitiesByPrefecture: vi.fn(),
  getPrefectures: vi.fn(),
  getPubStatuses: vi.fn(),
  getTags: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/master-repository", () => repositoryMocks);

import { GET as getMunicipalities } from "../../apps/web/app/api/admin/master/municipalities/route";
import { GET as getPrefectures } from "../../apps/web/app/api/admin/master/prefectures/route";
import { GET as getStatuses } from "../../apps/web/app/api/admin/master/statuses/route";
import { GET as getTags } from "../../apps/web/app/api/admin/master/tags/route";

const originalSessionSecret = process.env.ADMIN_SESSION_SECRET;
const originalAdminUsername = process.env.ADMIN_USERNAME;
const originalPasswordHash = process.env.ADMIN_PASSWORD_HASH;

function adminRequest(path: string, token = createAdminSession("admin")) {
  return new Request(`http://localhost${path}`, {
    headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}` },
  });
}

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "test-only-session-secret";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD_HASH = "test-only-hash";
  for (const mock of Object.values(repositoryMocks)) mock.mockReset();
});

afterEach(() => {
  if (originalSessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = originalSessionSecret;
  if (originalAdminUsername === undefined) delete process.env.ADMIN_USERNAME;
  else process.env.ADMIN_USERNAME = originalAdminUsername;
  if (originalPasswordHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = originalPasswordHash;
});

describe("admin master APIs", () => {
  it("rejects unauthenticated and invalid sessions before reading a repository", async () => {
    expect((await getPrefectures(new Request("http://localhost/api/admin/master/prefectures"))).status).toBe(401);
    expect((await getPrefectures(adminRequest("/api/admin/master/prefectures", "invalid"))).status).toBe(401);
    expect(repositoryMocks.getPrefectures).not.toHaveBeenCalled();
  });

  it("returns each master DTO to an authenticated administrator", async () => {
    repositoryMocks.getPrefectures.mockResolvedValue([{ code: 23, name: "愛知県" }]);
    repositoryMocks.getTags.mockResolvedValue([
      { id: "550e8400-e29b-41d4-a716-446655440001", key: "guinness", name: "ギネス" },
    ]);
    repositoryMocks.getPubStatuses.mockResolvedValue([{ code: 1, key: "open", name: "営業中" }]);

    await expect((await getPrefectures(adminRequest("/api/admin/master/prefectures"))).json()).resolves.toEqual({
      prefectures: [{ code: 23, name: "愛知県" }],
    });
    await expect((await getTags(adminRequest("/api/admin/master/tags"))).json()).resolves.toEqual({
      tags: [{ id: "550e8400-e29b-41d4-a716-446655440001", key: "guinness", name: "ギネス" }],
    });
    await expect((await getStatuses(adminRequest("/api/admin/master/statuses"))).json()).resolves.toEqual({
      statuses: [{ code: 1, key: "open", name: "営業中" }],
    });
  });

  it("validates prefectureCode before a parameterized municipality lookup", async () => {
    repositoryMocks.getMunicipalitiesByPrefecture.mockResolvedValue([
      { code: "231002", prefectureCode: 23, name: "名古屋市" },
    ]);

    const invalid = await getMunicipalities(adminRequest("/api/admin/master/municipalities?prefectureCode=23x"));
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ errorCode: "invalid_prefecture_code" });
    expect(repositoryMocks.getMunicipalitiesByPrefecture).not.toHaveBeenCalled();

    const valid = await getMunicipalities(adminRequest("/api/admin/master/municipalities?prefectureCode=23"));
    expect(valid.status).toBe(200);
    await expect(valid.json()).resolves.toEqual({
      municipalities: [{ code: "231002", prefectureCode: 23, name: "名古屋市" }],
    });
    expect(repositoryMocks.getMunicipalitiesByPrefecture).toHaveBeenCalledWith(23);
  });

  it("does not expose repository errors", async () => {
    repositoryMocks.getTags.mockRejectedValue(new Error("database connection detail"));
    const response = await getTags(adminRequest("/api/admin/master/tags"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ errorCode: "internal_error" });
  });
});
