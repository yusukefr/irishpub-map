import { beforeEach, describe, expect, it, vi } from "vitest";

const serverMocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getAdminSession: vi.fn(),
  isAdminConfigured: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: serverMocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: serverMocks.redirect }));
vi.mock("../../apps/web/app/lib/admin-auth", () => ({
  getAdminSession: serverMocks.getAdminSession,
  isAdminConfigured: serverMocks.isAdminConfigured,
}));

import { requireAdminSession } from "../../apps/web/app/lib/admin-server";

beforeEach(() => {
  serverMocks.cookies.mockReset();
  serverMocks.getAdminSession.mockReset();
  serverMocks.isAdminConfigured.mockReset();
  serverMocks.redirect.mockReset();
  serverMocks.cookies.mockResolvedValue({ toString: () => "irishpub_admin_session=signed" });
});

describe("requireAdminSession", () => {
  it("redirects when admin authentication is not configured", async () => {
    serverMocks.isAdminConfigured.mockReturnValue(false);

    await requireAdminSession();

    expect(serverMocks.redirect).toHaveBeenCalledWith("/admin/login");
    expect(serverMocks.cookies).not.toHaveBeenCalled();
  });

  it("redirects when the session is invalid", async () => {
    serverMocks.isAdminConfigured.mockReturnValue(true);
    serverMocks.getAdminSession.mockReturnValue(null);

    await requireAdminSession();

    expect(serverMocks.redirect).toHaveBeenCalledWith("/admin/login");
  });

  it("returns without redirecting when the session is valid", async () => {
    serverMocks.isAdminConfigured.mockReturnValue(true);
    serverMocks.getAdminSession.mockReturnValue({ username: "admin", expiresAt: Date.now() + 1000 });

    await requireAdminSession();

    expect(serverMocks.getAdminSession).toHaveBeenCalledWith("irishpub_admin_session=signed");
    expect(serverMocks.redirect).not.toHaveBeenCalled();
  });
});
