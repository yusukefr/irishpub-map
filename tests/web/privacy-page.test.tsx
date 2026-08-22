import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/app/lib/i18n/server", () => ({
  getRequestLocale: async () => "ja",
}));

vi.mock("../../apps/web/app/components/language-switcher", () => ({
  LanguageSwitcher: () => <div>言語切替</div>,
}));

import PrivacyPage from "../../apps/web/app/privacy/page";

describe("PrivacyPage", () => {
  it("利用する情報と計測機能を公開し、フッターからも到達できる", async () => {
    render(await PrivacyPage());

    expect(screen.getByRole("heading", { level: 1, name: "プライバシーポリシー" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "5. アクセス解析および性能測定" })).toBeInTheDocument();
    expect(screen.getByText(/OpenFreeMapのサーバーおよび配信に利用されるCDNへ直接通信/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OpenFreeMapのプライバシーポリシー" })).toHaveAttribute(
      "href",
      "https://openfreemap.org/privacy/",
    );
    expect(screen.getByText(/irishpub-map-locale/)).toBeInTheDocument();
    expect(screen.getByText(/Vercel Web Analyticsを利用してページビュー/)).toBeInTheDocument();
    expect(screen.getByText("最終更新日: 2026年8月21日")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy");
  });
});
