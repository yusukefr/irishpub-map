import { readFileSync } from "node:fs";
import { parse } from "postcss";
import { describe, expect, it } from "vitest";

const styles = readFileSync("apps/web/app/globals.css", "utf8");
const layout = readFileSync("apps/web/app/layout.tsx", "utf8");
const css = parse(styles);

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
    const aliases = {
      "--background": "--color-surface-page",
      "--surface": "--color-surface-raised",
      "--ink": "--color-text-primary",
      "--muted": "--color-text-secondary",
      "--line": "--color-border-default",
      "--accent": "--color-brand-interactive",
      "--accent-strong": "--color-brand-primary",
      "--danger": "--color-danger",
      "--content-card-radius": "--radius-lg",
      "--gold": "--color-brand-accent",
      "--gold-soft": "--color-brand-accent-soft",
      "--focus": "--color-focus-ring",
    };
    // 後段やmedia queryに同名のliteralが追加されても検出します。
    for (const [alias, token] of Object.entries(aliases)) {
      const values: string[] = [];
      css.walkDecls(alias, (declaration) => {
        values.push(declaration.value);
      });
      expect(values, alias).toEqual([`var(${token})`]);
    }
    const bodyFonts: string[] = [];
    css.walkRules((rule) => {
      if (rule.selectors.includes("body")) {
        rule.walkDecls(/^(font|font-family)$/, (declaration) => {
          bodyFonts.push(declaration.value);
        });
      }
    });
    expect(bodyFonts).toEqual(["var(--font-sans)"]);
  });

  it("defines a complete typography scale with size, line height, and weight", () => {
    const scale = [
      ["display-lg", "3rem", "1.1", "700"],
      ["display-md", "2.25rem", "1.15", "700"],
      ["heading-lg", "2rem", "1.25", "700"],
      ["heading-md", "1.5rem", "1.3", "700"],
      ["heading-sm", "1.25rem", "1.4", "600"],
      ["body-lg", "1.125rem", "1.7", "400"],
      ["body-md", "1rem", "1.6", "400"],
      ["body-sm", "0.875rem", "1.5", "400"],
      ["label", "0.875rem", "1.4", "600"],
      ["caption", "0.75rem", "1.4", "500"],
    ];
    for (const [name, size, height, weight] of scale) {
      for (const [suffix, expected] of [
        ["", size],
        ["--line-height", height],
        ["--font-weight", weight],
      ]) {
        const values: string[] = [];
        css.walkDecls(`--text-${name}${suffix}`, (declaration) => {
          values.push(declaration.value);
        });
        expect(values, `${name}${suffix}`).toEqual([expected]);
      }
    }
  });

  it("uses Next.js font variables and visible focus", () => {
    expect(layout).toContain("next/font/google");
    expect(layout).toContain("--font-ui");
    expect(layout).toContain("--font-editorial");
    expect(styles).toContain(":where(a, button, input, select, textarea):focus-visible");
  });
});
