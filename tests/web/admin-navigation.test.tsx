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
    fireEvent.click(screen.getByRole("button", { name: "管理メニュー" }));

    expect(screen.getByRole("link", { name: "Pubs" })).toHaveAttribute("href", "/admin/pubs");
    expect(screen.getByRole("link", { name: "Content" })).toHaveAttribute("href", "/admin/content");
    expect(screen.getByRole("link", { name: "Media" })).toHaveAttribute("href", "/admin/media");
    expect(screen.getByRole("link", { name: "Quiz" })).toHaveAttribute("href", "/admin/quiz");
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("href", "/admin/calendar");
    expect(screen.getByRole("link", { name: "Tags" })).toHaveAttribute("href", "/admin/tags");
    expect(screen.getByRole("link", { name: "Statuses" })).toHaveAttribute("href", "/admin/statuses");
    expect(screen.getByRole("link", { name: "Pubs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Tags" })).not.toHaveAttribute("aria-current");
  });

  it("marks Media and nested Media routes as active", () => {
    navigationMocks.pathname = "/admin/media/asset-one";
    render(<AdminNavigation locale="ja" />);
    fireEvent.click(screen.getByRole("button", { name: "管理メニュー" }));
    expect(screen.getByRole("link", { name: "Media" })).toHaveAttribute("aria-current", "page");
  });

  it("marks Calendar child routes as active", () => {
    navigationMocks.pathname = "/admin/calendar/8acbc777-5160-4f1d-8284-6db05f89485d";
    render(<AdminNavigation locale="ja" />);
    fireEvent.click(screen.getByRole("button", { name: "管理メニュー" }));

    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("aria-current", "page");
  });

  it("marks nested feature routes and logs out", async () => {
    navigationMocks.pathname = "/admin/tags/new";
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<AdminNavigation locale="ja" />);
    fireEvent.click(screen.getByRole("button", { name: "管理メニュー" }));

    expect(screen.getByRole("link", { name: "Tags" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    await waitFor(() => expect(navigationMocks.push).toHaveBeenCalledWith("/admin/login"));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/logout", { method: "POST" });
  });

  it("provides a translated, keyboard-operable compact menu control", () => {
    render(<AdminNavigation locale="en" />);

    const toggle = screen.getByRole("button", { name: "Admin menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Admin features" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("closes the compact menu when the current route changes", async () => {
    const { rerender } = render(<AdminNavigation locale="ja" />);
    const toggle = screen.getByRole("button", { name: "管理メニュー" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    navigationMocks.pathname = "/admin/calendar";
    rerender(<AdminNavigation locale="ja" />);

    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));

    navigationMocks.pathname = "/admin/pubs";
    rerender(<AdminNavigation locale="ja" />);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));

    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("link", { name: "Pubs" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
