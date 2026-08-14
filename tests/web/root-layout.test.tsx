import { Children } from "react";
import { describe, expect, it } from "vitest";

import RootLayout from "../../apps/web/app/layout";

describe("RootLayout", () => {
  it("includes Vercel Analytics and Speed Insights", () => {
    const layout = RootLayout({ children: <main>Irish Pub Map</main> });
    const body = Children.toArray(layout.props.children).find((child) => child.type === "body");
    const bodyChildren = Children.toArray(body.props.children);
    const componentNames = bodyChildren.map((child) => (typeof child.type === "function" ? child.type.name : ""));

    expect(componentNames).toEqual(
      expect.arrayContaining([expect.stringMatching(/Analytics/), expect.stringMatching(/SpeedInsights/)]),
    );
  });
});
