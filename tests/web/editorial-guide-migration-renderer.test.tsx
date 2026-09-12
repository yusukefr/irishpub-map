import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadGuides } from "../../scripts/migrate-editorial-guides.mjs";
import { SafeMarkdownRenderer } from "../../apps/web/app/lib/content/renderer";
import { getPublishedContentBySlug } from "../../apps/web/app/lib/content/repository";

const guides = await loadGuides();
afterEach(() => vi.unstubAllEnvs());

describe("migrated Guide renderer", () => {
  for (const guide of guides) {
    for (const locale of ["ja", "en"] as const) {
      it(`${guide.slug}/${locale}をSafe Markdown Rendererで表示する`, () => {
        const { container } = render(<SafeMarkdownRenderer markdown={guide.translations[locale].bodyMarkdown} />);
        expect(container.querySelector("p")).toBeTruthy();
        expect(container.querySelector("script,iframe,img")).toBeNull();
        expect(container).not.toHaveTextContent("export const metadata");
        if (guide.slug === "split-the-g") {
          expect(screen.getAllByRole("heading")).toHaveLength(6);
          expect(container.querySelectorAll("ol li")).toHaveLength(4);
          expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
            "https://www.guinness-storehouse.com/en/discover/story-of-guinness",
            "https://www.guinness-storehouse.com/en/whats-hoppening/most-popular-questions-about-guinness",
            "/",
          ]);
        }
      });
    }
  }

  it.skipIf(!process.env.MIGRATION_VERIFY_DATABASE_URL)(
    "NeonのRepositoryから4翻訳を読み、原文一致と表示を確認する",
    async () => {
      vi.stubEnv("DATABASE_URL", process.env.MIGRATION_VERIFY_DATABASE_URL!);
      for (const guide of guides) {
        for (const locale of ["ja", "en"] as const) {
          const content = await getPublishedContentBySlug("guide", guide.slug, locale);
          expect(content).not.toBeNull();
          expect(content).toMatchObject({ slug: guide.slug, category: guide.category, ...guide.translations[locale] });
          expect(new Date(content!.publishedAt).toISOString()).toBe(guide.publishedAt);
          const { container, unmount } = render(<SafeMarkdownRenderer markdown={content!.bodyMarkdown} />);
          expect(container.querySelector("p")).toBeTruthy();
          if (guide.slug === "split-the-g") expect(within(container).getAllByRole("link")).toHaveLength(3);
          unmount();
        }
      }
    },
    30000,
  );
});
