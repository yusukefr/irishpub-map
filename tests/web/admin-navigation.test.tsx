// 管理ナビゲーションの全導線、現在位置、ログアウト遷移を保証します。
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminNavigation } from "../../apps/web/app/components/admin-navigation";

const navigationMocks = vi.hoisted(() => ({ pathname: "/admin/pubs", push: vi.fn() }));
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMocks.pathname,
  useRouter: () => ({ push: navigationMocks.push }),
}));

beforeEach(() => {
  navigationMocks.pathname = "/admin/pubs";
  navigationMocks.push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("AdminNavigation", () => {
  it("links every management area and marks the current page", () => {
    render(<AdminNavigation locale="ja" />);

    expect(screen.getByRole("link", { name: "パブ" })).toHaveAttribute("href", "/admin/pubs");
    expect(screen.getByRole("link", { name: "タグ" })).toHaveAttribute("href", "/admin/tags");
    expect(screen.getByRole("link", { name: "ステータス" })).toHaveAttribute("href", "/admin/statuses");
    expect(screen.getByRole("link", { name: "パブ" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "タグ" })).not.toHaveAttribute("aria-current");
  });

  it("marks nested feature routes and logs out", async () => {
    navigationMocks.pathname = "/admin/tags/new";
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AdminNavigation locale="ja" />);

    expect(screen.getByRole("link", { name: "タグ" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    await waitFor(() => expect(navigationMocks.push).toHaveBeenCalledWith("/admin/login"));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/logout", { method: "POST" });
  });
});
