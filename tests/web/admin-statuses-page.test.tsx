import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pageMocks = vi.hoisted(() => ({ getAdminPubStatuses: vi.fn(), requireAdminSession: vi.fn() }));

vi.mock("../../apps/web/app/lib/admin-server", () => ({ requireAdminSession: pageMocks.requireAdminSession }));
vi.mock("../../apps/web/app/lib/status-repository", () => ({
  getAdminPubStatuses: pageMocks.getAdminPubStatuses,
}));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: () => Promise.resolve("ja") }));
vi.mock("../../apps/web/app/components/admin-status-manager", () => ({
  AdminStatusManager: ({ initialStatuses }: { initialStatuses: Array<{ nameJa: string }> }) => (
    <p>{initialStatuses.map((status) => status.nameJa).join(",")}</p>
  ),
}));

import AdminStatusesPage from "../../apps/web/app/admin/(protected)/statuses/page";

beforeEach(() => {
  pageMocks.getAdminPubStatuses.mockReset();
  pageMocks.requireAdminSession.mockReset();
});

describe("AdminStatusesPage", () => {
  it("does not load status data when the session is invalid", async () => {
    pageMocks.requireAdminSession.mockRejectedValue(new Error("redirect:/admin/login"));
    await expect(AdminStatusesPage()).rejects.toThrow("redirect:/admin/login");
    expect(pageMocks.getAdminPubStatuses).not.toHaveBeenCalled();
  });

  it("loads status data after validating the session", async () => {
    pageMocks.requireAdminSession.mockResolvedValue(undefined);
    pageMocks.getAdminPubStatuses.mockResolvedValue([{ nameJa: "営業中" }]);
    render(await AdminStatusesPage());
    expect(pageMocks.requireAdminSession.mock.invocationCallOrder[0]).toBeLessThan(
      pageMocks.getAdminPubStatuses.mock.invocationCallOrder[0],
    );
    expect(screen.getByText("営業中")).toBeInTheDocument();
  });
});
