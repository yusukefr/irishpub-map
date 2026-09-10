import { expect, test, type BrowserContext } from "@playwright/test";
import { mockExternalMapStyle } from "./support/page-helpers";

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

/** 主要な公開画面の意図しない視覚差分を検出します。 */
test.describe("Public UI visual regression", () => {
  test("Map desktop Japanese", async ({ context, page }) => {
    await useLocale(context, "ja");
    await mockExternalMapStyle(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Irish Pub の地図と一覧" })).toBeVisible();
    await expect(page).toHaveScreenshot("map-desktop-ja.png", { animations: "disabled", fullPage: true });
  });

  test("Map desktop English", async ({ context, page }) => {
    await useLocale(context, "en");
    await mockExternalMapStyle(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("region", { name: "Irish Pub map and list" })).toBeVisible();
    await expect(page).toHaveScreenshot("map-desktop-en.png", { animations: "disabled", fullPage: true });
  });

  test("Map mobile Japanese", async ({ context, page }) => {
    await useLocale(context, "ja");
    await mockExternalMapStyle(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("searchbox", { name: "店舗を検索" })).toBeVisible();
    await expect(page).toHaveScreenshot("map-mobile-ja.png", { animations: "disabled", fullPage: true });
  });

  for (const scenario of [
    { name: "desktop Japanese", locale: "ja" as const, width: 1440, height: 900, snapshot: "discover-desktop-ja.png" },
    { name: "desktop English", locale: "en" as const, width: 1280, height: 900, snapshot: "discover-desktop-en.png" },
    { name: "mobile Japanese", locale: "ja" as const, width: 390, height: 844, snapshot: "discover-mobile-ja.png" },
    { name: "mobile English", locale: "en" as const, width: 360, height: 800, snapshot: "discover-mobile-en.png" },
  ]) {
    test("Discover " + scenario.name, async ({ context, page }) => {
      await useLocale(context, scenario.locale);
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await page.goto("/discover");
      await expect(page.getByRole("heading", { level: 1, name: "Explore Ireland" })).toBeVisible();
      await expect(page).toHaveScreenshot(scenario.snapshot, { animations: "disabled", fullPage: true });
    });
  }
});
