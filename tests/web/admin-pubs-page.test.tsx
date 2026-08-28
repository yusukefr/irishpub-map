import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pageMocks = vi.hoisted(() => ({
  getAdminPubs: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  requireAdminSession: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/admin-server", () => ({
  requireAdminSession: pageMocks.requireAdminSession,
}));
vi.mock("../../apps/web/app/lib/pub-repository", () => ({
  getAdminPubs: pageMocks.getAdminPubs,
  isDatabaseConfigured: pageMocks.isDatabaseConfigured,
}));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: () => Promise.resolve("ja") }));
vi.mock("../../apps/web/app/components/admin-pub-manager", () => ({
  AdminPubManager: ({ initialPubs }: { initialPubs: Array<{ name: string }> }) => (
    <p>{initialPubs.map((pub) => pub.name).join(",")}</p>
  ),
}));

import AdminPubsPage from "../../apps/web/app/admin/(protected)/pubs/page";

beforeEach(() => {
  pageMocks.getAdminPubs.mockReset();
  pageMocks.isDatabaseConfigured.mockReset();
  pageMocks.requireAdminSession.mockReset();
});

describe("AdminPubsPage", () => {
  it("does not load admin pubs when the session is invalid", async () => {
    pageMocks.requireAdminSession.mockRejectedValue(new Error("redirect:/admin/login"));

    await expect(AdminPubsPage()).rejects.toThrow("redirect:/admin/login");
    expect(pageMocks.getAdminPubs).not.toHaveBeenCalled();
  });

  it("loads admin pubs after validating the session", async () => {
    pageMocks.requireAdminSession.mockResolvedValue(undefined);
    pageMocks.getAdminPubs.mockResolvedValue([{ name: "Draft pub" }]);
    pageMocks.isDatabaseConfigured.mockReturnValue(true);

    render(await AdminPubsPage());

    expect(pageMocks.requireAdminSession).toHaveBeenCalledOnce();
    expect(pageMocks.getAdminPubs).toHaveBeenCalledOnce();
    expect(pageMocks.requireAdminSession.mock.invocationCallOrder[0]).toBeLessThan(
      pageMocks.getAdminPubs.mock.invocationCallOrder[0],
    );
    expect(screen.getByText("Draft pub")).toBeInTheDocument();
  });
});
