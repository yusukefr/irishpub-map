import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pageMocks = vi.hoisted(() => ({
  getRequestLocale: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: pageMocks.headers }));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: pageMocks.getRequestLocale }));
vi.mock("../../apps/web/app/components/pub-explorer", () => ({
  PubExplorer: () => <section aria-label="探索UI" />,
}));

import Home from "../../apps/web/app/page";

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
  it("renders the map app shell with compact header, workspace, and footer", async () => {
    render(await Home());

    expect(document.querySelector(".map-app-shell")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("map-app-main");
    expect(screen.getByRole("heading", { level: 1, name: "Irish Pub Map" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "探索UI" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo", { name: "アプリのバージョン情報" })).toHaveClass("app-version-compact");
    expect(screen.getByRole("contentinfo")).not.toHaveTextContent("Release Date");
  });
});
