import { Children } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/app/lib/i18n/server", () => ({
  getRequestLocale: async () => "ja",
}));

vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => null,
}));

vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: () => null,
}));

import RootLayout from "../../apps/web/app/layout";

describe("RootLayout", () => {
  it("Vercel AnalyticsとSpeed Insightsを全ページに追加する", async () => {
    const layout = await RootLayout({ children: <main>Irish Pub Map</main> });
    const body = Children.toArray(layout.props.children).find((child) => child.type === "body");
    const bodyChildren = Children.toArray(body.props.children);
    const componentNames = bodyChildren.map((child) => (typeof child.type === "function" ? child.type.name : ""));

    expect(bodyChildren).toHaveLength(3);
    expect(componentNames).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Analytics/), expect.stringMatching(/^SpeedInsights/)]),
    );
  });
});
