import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pageMocks = vi.hoisted(() => ({
  getRequestLocale: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: pageMocks.headers }));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: pageMocks.getRequestLocale }));
vi.mock("../../apps/web/app/components/pub-explorer", () => ({
  PubExplorer: ({ dataLoadFailed }: { dataLoadFailed: boolean }) => (
    <section aria-label="探索UI" data-load-failed={dataLoadFailed} />
  ),
}));

import Home from "../../apps/web/app/(map)/page";
import MapLayout from "../../apps/web/app/(map)/layout";

beforeEach(() => {
  pageMocks.getRequestLocale.mockReset().mockResolvedValue("ja");
  pageMocks.headers.mockReset().mockResolvedValue(new Headers({ host: "localhost:3000" }));
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ pubs: [] }), { status: 200, headers: { "content-type": "application/json" } }),
      ),
  );
});

describe("Home", () => {
  it("keeps the explorer available without exposing a failed API response", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("internal connection detail"));
    render(await Home());
    expect(screen.getByRole("region", { name: "探索UI" })).toHaveAttribute("data-load-failed", "true");
    expect(screen.queryByText("internal connection detail")).not.toBeInTheDocument();
  });
  it("renders the map page content without owning the application shell", async () => {
    render(await Home());

    expect(document.querySelector(".map-app-shell")).not.toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Irish Pub Map" })).toHaveClass("visually-hidden");
    expect(screen.getByRole("region", { name: "探索UI" })).toBeInTheDocument();
  });

  it("owns the Map viewport shell separately from the page content", async () => {
    render(await MapLayout({ children: <div data-testid="map-content" /> }));

    expect(document.querySelector(".map-app-shell")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore Ireland" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("main")).toHaveClass("map-app-main");
    expect(screen.getByTestId("map-content")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo", { name: "アプリのバージョン情報" })).toHaveClass("app-version-compact");
  });
});
