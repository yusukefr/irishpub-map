import { Children } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/app/lib/i18n/server", () => ({
  getRequestLocale: async () => "ja",
}));

import RootLayout from "../../apps/web/app/layout";

describe("RootLayout", () => {
  it("keeps Vercel Analytics and Speed Insights disabled", async () => {
    const layout = await RootLayout({ children: <main>Irish Pub Map</main> });
    const body = Children.toArray(layout.props.children).find((child) => child.type === "body");
    const bodyChildren = Children.toArray(body.props.children);
    const componentNames = bodyChildren.map((child) => (typeof child.type === "function" ? child.type.name : ""));

    expect(bodyChildren).toHaveLength(1);
    expect(componentNames).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/Analytics/), expect.stringMatching(/SpeedInsights/)]),
    );
  });
});
