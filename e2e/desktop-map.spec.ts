import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { getTranslation, formatMessage } from "../apps/web/app/lib/i18n";
import { E2E_TEST_DATA } from "../apps/web/app/lib/e2e-test-fixtures";
import { mockExternalMapStyle } from "./support/page-helpers";

for (const locale of ["ja", "en"] as const) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    test(`Desktop exploration: ${locale} ${viewport.width}`, async ({ context, page }, testInfo) => {
      const t = getTranslation(locale);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await context.addCookies([{ name: "irishpub-map-locale", value: locale, domain: "localhost", path: "/" }]);
      await page.setViewportSize(viewport);
      await mockExternalMapStyle(page);
      await page.goto("/");
      const results = page.getByRole("complementary", { name: t.list.heading });
      const map = page.locator(".map-workspace");
      const search = page.getByRole("searchbox", { name: t.explorer.searchLabel });
      await expect(results).toBeVisible();
      await expect(page.locator(".pub-map-marker")).toHaveCount(2);
      await expect(page.getByRole("link", { name: t.navigation.map, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.locator(".pub-results-close")).not.toBeFocused();
      const panelRect = (await results.boundingBox())!;
      const mapRect = (await map.boundingBox())!;
      expect(panelRect.width).toBeGreaterThanOrEqual(359);
      expect(panelRect.width).toBeLessThanOrEqual(400);
      expect(panelRect.x + panelRect.width).toBeLessThanOrEqual(mapRect.x);
      expect(mapRect.width).toBeGreaterThan(viewport.width * 0.6);
      await expect(map.getByRole("button", { name: t.map.zoomIn, exact: true })).toBeVisible();
      for (const button of await page.locator(".maplibregl-ctrl-group button, .pub-map-marker").all()) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }

      const tokyo = E2E_TEST_DATA.pubs.tokyo.name;
      const cardButton = results.getByRole("button", { name: formatMessage(t.list.selectPub, { name: tokyo }) });
      await cardButton.click();
      await expect(cardButton).toBeFocused();
      const marker = map.getByRole("button", { name: formatMessage(t.map.selectPub, { name: tokyo }) });
      await expect(marker).toHaveAttribute("aria-pressed", "true");
      await expect(results.locator('article[data-selected="true"]')).toContainText(tokyo);
      await page.mouse.move(10, 20);
      if (locale === "ja" && viewport.width === 1440) {
        await expect(page).toHaveScreenshot("map-desktop-pub-selected.png", { animations: "disabled" });
      }
      await results
        .locator('article[data-selected="true"]')
        .getByRole("button", { name: t.list.details, exact: true })
        .click();
      const back = page.getByRole("button", { name: new RegExp(t.list.backToResults) });
      await expect(back).toBeFocused();
      await back.click();
      await expect(cardButton).toBeVisible();
      await results.getByRole("button", { name: t.list.closeResults }).click();
      await expect(results).toBeHidden();
      await expect(page.locator(".map-result-count")).toBeFocused();
      await marker.click();
      await expect(results).toBeVisible();
      await expect(results.locator('article[data-selected="true"]')).toContainText(tokyo);
      // Popupの一時表示を閉じてからパネルだけの操作を検証します。
      await map.locator("canvas").click({ position: { x: 20, y: 20 } });

      const filterToggle = page.locator(".filter-toggle");
      await filterToggle.click();
      const filters = page.locator("#pub-filter-options");
      await expect(filters).toBeVisible();
      await expect(results).toBeVisible();
      const filterRect = (await filters.boundingBox())!;
      expect(filterRect.x + filterRect.width).toBeLessThanOrEqual(mapRect.x);
      // 詳細条件を内部スクロールしても、検索と件数・地図の操作領域は動きません。
      await filters.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      await expect(search).toBeInViewport();
      await expect(page.locator(".map-result-count")).toBeInViewport();
      expect((await map.boundingBox())!.height).toBe(mapRect.height);
      await page
        .getByRole("combobox", { name: t.explorer.prefecture, exact: true })
        .selectOption(locale === "ja" ? "東京都" : "Tokyo");
      await expect(page.locator(".filter-toggle-count")).toHaveText("1");
      await expect(results.locator("article")).toHaveCount(1);
      if (locale === "ja" && viewport.width === 1440) {
        await page.mouse.move(10, 20);
        await expect(page).toHaveScreenshot("map-desktop-filters-open.png", { animations: "disabled" });
      }
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(filters).toBeHidden();
      await expect(results).toBeVisible();
      await expect(filterToggle).toBeFocused();
      await search.fill("no matching pub");
      await expect(results.getByRole("heading", { name: t.list.noResults })).toBeVisible();
      await results.getByRole("button", { name: t.explorer.resetFilters }).click();
      await expect(search).toHaveValue("");
      await expect(search).toBeFocused();
      await expect(results.locator("article")).toHaveCount(2);
      await search.fill("Nagoya");
      await page.getByRole("button", { name: t.explorer.clear, exact: true }).click();
      await expect(search).toBeFocused();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
        ),
      ).toBe(false);
      await page.screenshot({ path: testInfo.outputPath("desktop-map.png"), fullPage: true });
      expect(errors).toEqual([]);
    });
  }

  test(`Tablet boundary: ${locale} 768px`, async ({ context, page }, testInfo) => {
    const t = getTranslation(locale);
    await context.addCookies([{ name: "irishpub-map-locale", value: locale, domain: "localhost", path: "/" }]);
    await page.setViewportSize({ width: 768, height: 900 });
    await mockExternalMapStyle(page);
    await page.goto("/");
    await expect(page.locator(".map-result-count")).toHaveAttribute("aria-expanded", "false");
    await page.locator(".map-result-count").click();
    const results = page.getByRole("complementary", { name: t.list.heading });
    await expect(results).toBeVisible();
    const panel = (await results.boundingBox())!;
    const map = (await page.locator(".map-workspace").boundingBox())!;
    expect(panel.height).toBeLessThan(map.height * 0.8);
    await results.getByRole("button", { name: t.list.closeResults }).click();
    await page.locator(".filter-toggle").click();
    await expect(page.locator("#pub-filter-options")).toBeVisible();
    await expect(page.getByRole("searchbox")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("tablet-filters.png"), fullPage: true });
  });
}

test("Map load failure can be retried without clearing search or selection", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("https://tiles.openfreemap.org/styles/bright*", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("searchbox").fill("Tokyo");
  await page.locator(".pub-results-panel article button[aria-pressed]").click();
  const error = page.locator(".map-error");
  await expect(error).toBeVisible({ timeout: 20_000 });
  await mockExternalMapStyle(page);
  await error.getByRole("button", { name: "地図を再読み込み" }).click();
  await expect(error).toBeHidden();
  await expect(page.locator(".map-loading")).toBeHidden();
  await expect(page.getByRole("searchbox")).toHaveValue("Tokyo");
  await expect(page.locator(".pub-map-marker[aria-pressed=true]")).toHaveCount(1);
});
