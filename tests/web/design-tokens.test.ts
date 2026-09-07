import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("apps/web/app/globals.css", "utf8");
const layout = readFileSync("apps/web/app/layout.tsx", "utf8");

describe("Design Tokens", () => {
  it("defines semantic color, scale, motion, and focus tokens", () => {
    [
      "--color-brand-primary: #0b553e",
      "--color-surface-page: #f7f3ea",
      "--color-focus-ring: #175cd3",
      "--spacing-space-1: 4px",
      "--spacing-space-16: 64px",
      "--radius-lg: 18px",
      "--shadow-elevation-1:",
      "--motion-duration-normal: 180ms",
    ].forEach((token) => expect(styles).toContain(token));
  });

  it("keeps legacy variables mapped to semantic tokens", () => {
    expect(styles).toContain("--background: var(--color-surface-page)");
    expect(styles).toContain("--accent-strong: var(--color-brand-primary)");
  });

  it("uses Next.js font variables and visible focus", () => {
    expect(layout).toContain("next/font/google");
    expect(layout).toContain("--font-ui");
    expect(layout).toContain("--font-editorial");
    expect(styles).toContain(":where(a, button, input, select, textarea):focus-visible");
  });
});
