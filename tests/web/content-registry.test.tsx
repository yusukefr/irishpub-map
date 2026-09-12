import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getContentRenderer } from "../../apps/web/app/lib/content/registry";
import { SafeMarkdownRenderer } from "../../apps/web/app/lib/content/renderer";

describe("content renderer registry", () => {
  it("kindを固定Rendererへ対応付け、DB値からimport pathを解決しない", () => {
    expect(getContentRenderer("guide")).toBeDefined();
    expect(getContentRenderer("story")).toBeDefined();
  });
  it("許可したMarkdownと安全な画像を描画し、Raw HTMLと危険URLを無効化する", () => {
    render(
      <SafeMarkdownRenderer
        markdown={
          "# 見出し\n\n![店内](/images/pub.webp)\n\n![危険](javascript:alert(1))\n\n[危険](javascript:alert(1))\n\n[email](mailto:feedback)\n\n<script>window.__xss = true</script>\n\n| A | B |\n| - | - |\n| 1 | 2 |"
        }
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "見出し" })).toBeInTheDocument();
    const image = screen.getByRole("img", { name: "店内" });
    expect(image).toHaveAttribute("src", "/images/pub.webp");
    expect(image).toHaveAttribute("width", "720");
    expect(image).toHaveAttribute("height", "405");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(screen.queryByRole("img", { name: "危険" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "危険" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "email" })).not.toBeInTheDocument();
    expect(screen.queryByText("window.__xss = true")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
