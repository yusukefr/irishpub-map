import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function useLocale(context: BrowserContext, locale: "ja" | "en"): Promise<void> {
  await context.addCookies([
    {
      name: "irishpub-map-locale",
      value: locale,
      domain: "localhost",
      path: "/",
    },
  ]);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth);
}

test.describe("Discover editorial pages", () => {
  test("Draftと存在しないGuideは404にする", async ({ page }) => {
    for (const slug of ["e2e-draft-guide", "not-exist"]) {
      const response = await page.goto("/discover/guides/" + slug);
      expect(response?.status()).toBe(404);
    }
  });

  for (const scenario of [
    { locale: "ja" as const, width: 1440, height: 900 },
    { locale: "en" as const, width: 1280, height: 900 },
    { locale: "ja" as const, width: 390, height: 844 },
    { locale: "en" as const, width: 360, height: 800 },
  ]) {
    test(scenario.locale + " " + scenario.width + "pxでトップの階層と導線を保つ", async ({ context, page }) => {
      await useLocale(context, scenario.locale);
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await page.goto("/discover");

      await expect(page.getByRole("heading", { level: 1, name: "Explore Ireland" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Guides" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 3 })).toHaveCount(2);
      await expect(
        page.getByRole("link", {
          name: scenario.locale === "ja" ? "地図でIrish Pubを探す" : "Find an Irish pub on the map",
        }),
      ).toHaveAttribute("href", "/");
      await expectNoHorizontalOverflow(page);
    });
  }

  for (const route of ["/discover/calendar", "/discover/quiz", "/discover/guides/split-the-g"]) {
    test(route + "がパンくずと3件の関連導線を表示する", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route);

      await expect(page.getByRole("navigation", { name: "現在位置" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "次にExploreする" })).toBeVisible();
      await expect(page.locator(".discover-related-grid").getByRole("link")).toHaveCount(3);
      await expectNoHorizontalOverflow(page);
    });
  }
});
