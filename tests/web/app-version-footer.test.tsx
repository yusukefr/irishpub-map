// リリース情報がフッターへ正しく表示されることを保証するテストです。
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminReleaseInfo } from "../../apps/web/app/components/admin-release-info";
import { AppVersionFooter } from "../../apps/web/app/components/app-version-footer";

afterEach(() => vi.unstubAllEnvs());

function setReleaseMetadata() {
  vi.stubEnv("APP_RELEASE_VERSION", "v0.1.65");
  vi.stubEnv("APP_RELEASE_DATE", "2026-10-04T12:42:00+09:00");
  vi.stubEnv("APP_RELEASE_GIT_SHA", "a".repeat(40));
}

describe("release display", () => {
  it("shows version and JST minute in Japanese without exposing the SHA publicly", () => {
    setReleaseMetadata();
    render(<AppVersionFooter locale="ja" />);

    const footer = screen.getByRole("contentinfo", { name: "アプリのバージョン情報" });
    expect(footer.querySelector(".app-version-number")).toHaveTextContent("v0.1.65");
    expect(footer.querySelector(".app-version-release-date")).toHaveTextContent("2026-10-04 12:42 JST リリース");
    expect(footer.outerHTML).not.toContain("a".repeat(40));
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy");
  });

  it("keeps the date visible in the compact map footer and translates English", () => {
    setReleaseMetadata();
    render(<AppVersionFooter locale="en" variant="compact" />);

    const footer = screen.getByRole("contentinfo", { name: "App version information" });
    expect(footer).toHaveClass("app-version-compact");
    expect(footer.querySelector(".app-version-release-date")).toHaveTextContent("2026-10-04 12:42 JST");
    expect(footer.outerHTML).not.toContain("a".repeat(40));
  });

  it("shows a Local fallback and keeps the full SHA available only in Admin", () => {
    render(<AppVersionFooter locale="ja" />);
    expect(screen.getByRole("contentinfo", { name: "アプリのバージョン情報" })).toHaveTextContent("Development");
    setReleaseMetadata();
    render(<AdminReleaseInfo locale="en" />);
    const panel = screen.getByRole("complementary", { name: "Release Information" });
    expect(panel).toHaveTextContent("2026-10-04 12:42 JST");
    expect(panel.querySelector("code")).toHaveTextContent("aaaaaaaaaaaa");
    expect(panel.querySelector("code")).toHaveAttribute("title", "a".repeat(40));
  });
});
