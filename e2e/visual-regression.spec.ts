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

  test("Discover mobile Japanese", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/discover");
    await expect(page.getByRole("heading", { level: 1, name: "Explore Ireland" })).toBeVisible();
    await expect(page).toHaveScreenshot("discover-mobile-ja.png", { animations: "disabled", fullPage: true });
  });
});
