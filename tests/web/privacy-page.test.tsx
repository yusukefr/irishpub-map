import { render, screen } from "@testing-library/react";
import enPolicy from "../../apps/web/app/lib/i18n/privacy/en.json";
import jaPolicy from "../../apps/web/app/lib/i18n/privacy/ja.json";
import { describe, expect, it, vi } from "vitest";

const locale = vi.hoisted(() => ({ value: "ja" as "ja" | "en" }));

vi.mock("../../apps/web/app/lib/i18n/server", () => ({
  getRequestLocale: async () => locale.value,
}));

vi.mock("../../apps/web/app/components/language-switcher", () => ({
  LanguageSwitcher: () => <div>言語切替</div>,
}));

import PrivacyPage from "../../apps/web/app/privacy/page";

describe("PrivacyPage", () => {
  it("日本語版と英語版のポリシーJSONは同じセクション構造を持つ", () => {
    const shape = (policy: typeof jaPolicy) =>
      policy.sections.map(({ items, links }) => ({ hasItems: items !== undefined, hasLinks: links !== undefined }));

    expect(shape(enPolicy)).toEqual(shape(jaPolicy));
  });
  it("利用する情報と計測機能を公開し、フッターからも到達できる", async () => {
    render(await PrivacyPage());

    expect(screen.getByRole("heading", { level: 1, name: "プライバシーポリシー" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "5. アクセス解析および性能測定" })).toBeInTheDocument();
    expect(screen.getByText(/OpenFreeMapのサーバーおよび配信に利用されるCDNへ直接通信/)).toBeInTheDocument();
    expect(
      screen.getAllByText(/OpenFreeMapが配信する地図データにはOpenMapTilesおよびOpenStreetMapのデータ/),
    ).toHaveLength(2);
    expect(screen.getByRole("link", { name: "OpenFreeMapのプライバシーポリシー" })).toHaveAttribute(
      "href",
      "https://openfreemap.org/privacy/",
    );
    expect(screen.getByText(/irishpub-map-locale/)).toBeInTheDocument();
    expect(screen.getByText(/Vercel Web Analyticsを利用してページビュー/)).toBeInTheDocument();
    expect(screen.getByText("最終更新日: 2026年8月21日")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("article", { name: "プライバシーポリシー" })).toHaveAttribute("lang", "ja");
  });

  it("英語ロケールでは英語版の本文とlang属性を表示する", async () => {
    locale.value = "en";

    render(await PrivacyPage());

    expect(screen.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "5. Analytics and performance measurement" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This service uses Vercel Web Analytics to aggregate and analyze usage/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "OpenFreeMap privacy policy" })).toHaveAttribute(
      "href",
      "https://openfreemap.org/privacy/",
    );
    expect(screen.getByRole("article", { name: "Privacy policy" })).toHaveAttribute("lang", "en");
  });
});
