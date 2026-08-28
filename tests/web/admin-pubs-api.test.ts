// 管理店舗APIが認証済み管理者だけへ公開・非公開店舗を返すことを保証します。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "../../apps/web/app/lib/admin-auth";

const repositoryMocks = vi.hoisted(() => ({
  createPub: vi.fn(),
  getAdminPubs: vi.fn(),
  isDatabaseConfigured: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/pub-repository", () => repositoryMocks);

import { GET } from "../../apps/web/app/api/admin/pubs/route";

const originalSessionSecret = process.env.ADMIN_SESSION_SECRET;
const originalAdminUsername = process.env.ADMIN_USERNAME;
const originalPasswordHash = process.env.ADMIN_PASSWORD_HASH;

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "test-only-session-secret";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD_HASH = "test-only-hash";
  repositoryMocks.getAdminPubs.mockReset();
  repositoryMocks.getAdminPubs.mockResolvedValue([
    { id: "pub-1", name: "Published", isPublished: true },
    { id: "pub-2", name: "Draft", isPublished: false },
  ]);
  repositoryMocks.isDatabaseConfigured.mockReset();
  repositoryMocks.isDatabaseConfigured.mockReturnValue(true);
});

afterEach(() => {
  if (originalSessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = originalSessionSecret;
  if (originalAdminUsername === undefined) delete process.env.ADMIN_USERNAME;
  else process.env.ADMIN_USERNAME = originalAdminUsername;
  if (originalPasswordHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = originalPasswordHash;
});

describe("GET /api/admin/pubs", () => {
  it("rejects unauthenticated requests before reading pubs", async () => {
    const response = await GET(new Request("http://localhost/api/admin/pubs"));

    expect(response.status).toBe(401);
    expect(repositoryMocks.getAdminPubs).not.toHaveBeenCalled();
  });

  it("returns both publication states to an authenticated administrator", async () => {
    const session = createAdminSession("admin");
    const response = await GET(
      new Request("http://localhost/api/admin/pubs", {
        headers: { cookie: `${ADMIN_SESSION_COOKIE}=${session}` },
      }),
    );

    await expect(response.json()).resolves.toEqual({
      pubs: [
        { id: "pub-1", name: "Published", isPublished: true },
        { id: "pub-2", name: "Draft", isPublished: false },
      ],
      databaseConfigured: true,
    });
    expect(response.status).toBe(200);
  });
});
