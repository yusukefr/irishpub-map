// リリース情報がフッターへ正しく表示されることを保証するテストです。
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import appVersion from "../../app-version.json";
import { AppVersionFooter } from "../../apps/web/app/components/app-version-footer";

describe("AppVersionFooter", () => {
  it("renders the app version and release date from the version file", () => {
    render(<AppVersionFooter locale="ja" />);

    const versionInfo = screen.getByRole("contentinfo", { name: "アプリのバージョン情報" });
    expect(versionInfo).toHaveTextContent(`v${appVersion.version}`);
    expect(versionInfo).toHaveTextContent(`Release Date ${appVersion.releaseDate}（JST）`);
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy");
  });
  it("renders translated footer text in English", () => {
    render(<AppVersionFooter locale="en" />);

    expect(screen.getByRole("contentinfo", { name: "App version information" })).toHaveTextContent(
      `Release date ${appVersion.releaseDate} (JST)`,
    );
    expect(screen.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy");
  });
  it("renders a compact footer without the release date", () => {
    render(<AppVersionFooter locale="ja" variant="compact" />);

    const footer = screen.getByRole("contentinfo", { name: "アプリのバージョン情報" });
    expect(footer).toHaveTextContent("v" + appVersion.version);
    expect(footer).not.toHaveTextContent("Release Date " + appVersion.releaseDate + "（JST）");
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy");
  });
});
