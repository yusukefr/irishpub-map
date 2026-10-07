// 管理レイアウトが設定不足を案内し、未認証を拒否して認証済みページだけを表示することを保証します。
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const layoutMocks = vi.hoisted(() => ({
  isAdminConfigured: vi.fn(),
  requireAdminSession: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/admin-auth", () => ({
  isAdminConfigured: layoutMocks.isAdminConfigured,
}));
vi.mock("../../apps/web/app/lib/admin-server", () => ({
  requireAdminSession: layoutMocks.requireAdminSession,
}));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: () => Promise.resolve("ja") }));
vi.mock("../../apps/web/app/components/admin-navigation", () => ({
  AdminNavigation: () => (
    <nav aria-label="管理機能">
      navigation
      <button type="button">ログアウト</button>
    </nav>
  ),
}));
vi.mock("../../apps/web/app/components/admin-release-info", () => ({
  AdminReleaseInfo: () => <aside aria-label="リリース情報">Version / Release Date / Git Commit</aside>,
}));

import AdminLayout from "../../apps/web/app/admin/(protected)/layout";

beforeEach(() => {
  layoutMocks.isAdminConfigured.mockReset();
  layoutMocks.requireAdminSession.mockReset();
});

describe("AdminLayout", () => {
  it("shows setup guidance when admin authentication is not configured", async () => {
    layoutMocks.isAdminConfigured.mockReturnValue(false);
    render(await AdminLayout({ children: <p>protected</p> }));

    expect(screen.getByRole("heading", { name: "管理画面の設定が必要です" })).toBeInTheDocument();
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
    expect(layoutMocks.requireAdminSession).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated request before rendering protected content", async () => {
    layoutMocks.isAdminConfigured.mockReturnValue(true);
    layoutMocks.requireAdminSession.mockRejectedValue(new Error("redirect:/admin/login"));

    await expect(AdminLayout({ children: <p>protected</p> })).rejects.toThrow("redirect:/admin/login");
  });

  it("renders navigation and content for an authenticated administrator", async () => {
    layoutMocks.isAdminConfigured.mockReturnValue(true);
    layoutMocks.requireAdminSession.mockResolvedValue(undefined);
    render(await AdminLayout({ children: <p>protected</p> }));

    expect(screen.getByRole("navigation", { name: "管理機能" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "リリース情報" })).toBeInTheDocument();
    expect(screen.getByText("protected")).toBeInTheDocument();
  });
});
