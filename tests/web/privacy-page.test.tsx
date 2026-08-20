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
  it("外部送信と保存方針を公開し、フッターからも到達できる", async () => {
    render(await PrivacyPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "プライバシーポリシー・外部送信について" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "2. Vercelによるサイト配信とログ" })).toBeInTheDocument();
    expect(screen.getByText(/tile\.openstreetmap\.org/)).toBeInTheDocument();
    expect(screen.getByText(/irishpub-map-locale/)).toBeInTheDocument();
    expect(screen.getByText(/Vercel Web Analytics と Vercel Speed Insights は現在停止しています/)).toBeInTheDocument();
    expect(screen.getByText("最終更新日: 2026年8月21日")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "プライバシーポリシー・外部送信について" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
