import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { getTranslation } from "../apps/web/app/lib/i18n";
import { mockExternalMapStyle } from "./support/page-helpers";

for (const locale of ["ja", "en"] as const) {
  for (const width of [390, 360]) {
    test(`Mobile exploration ${locale} ${width}`, async ({ context, page }) => {
      const t = getTranslation(locale);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await context.addCookies([{ name: "irishpub-map-locale", value: locale, domain: "localhost", path: "/" }]);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await mockExternalMapStyle(page);
      await page.goto("/");
      const sheet = page.locator("section[data-state]");
      const handle = page.getByRole("button", { name: new RegExp(t.explorer.resizeSheet) });
      const search = page.getByRole("searchbox", { name: t.explorer.searchLabel });
      await expect(page.locator(".pub-map-marker")).toHaveCount(2);
      await expect(sheet).toHaveAttribute("data-state", "collapsed");
      expect((await sheet.boundingBox())!.height).toBeLessThan(100);
      await expect(search).toBeInViewport();
      const menu = page.locator(".app-header summary");
      await menu.click();
      await expect(page.getByRole("link", { name: t.discover.navigation, exact: true })).toBeVisible();
      await menu.click();
      if (width === 390) {
        await expect(page).toHaveScreenshot(`map-mobile-${locale}.png`, { animations: "disabled" });
      }
      for (const button of await page.locator(".pub-map-marker, .maplibregl-ctrl-group button").all()) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.y + box.height).toBeLessThan((await sheet.boundingBox())!.y);
      }
      // 地図panとpinchはSheetの状態を変更しません。
      const canvas = page.locator(".map-workspace canvas");
      const mapBox = (await canvas.boundingBox())!;
      await page.mouse.move(width / 2, mapBox.y + mapBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(width / 2 + 30, mapBox.y + mapBox.height / 2 + 40, { steps: 8 });
      await page.mouse.up();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Input.synthesizePinchGesture", {
        x: width / 2,
        y: mapBox.y + mapBox.height / 2,
        scaleFactor: 1.2,
        gestureSourceType: "touch",
      });
      await expect(sheet).toHaveAttribute("data-state", "collapsed");
      await page.locator(".pub-map-marker").first().click();
      await expect(sheet).toHaveAttribute("data-state", "medium");
      await expect(page.locator('article[data-selected="true"]')).toHaveCount(1);
      await canvas.click({ position: { x: 10, y: 240 } });
      if (width === 390 && locale === "ja") {
        await expect(page).toHaveScreenshot("map-mobile-bottom-sheet-medium.png", { animations: "disabled" });
      }
      const results = page.locator(".pub-results-panel");
      await results
        .locator('article[data-selected="true"]')
        .getByRole("button", { name: t.list.details, exact: true })
        .click();
      await expect(sheet).toHaveAttribute("data-state", "expanded");
      const back = page.getByRole("button", { name: new RegExp(t.list.backToResults) });
      await expect(back).toBeFocused();
      if (width === 390 && locale === "ja") {
        await expect(page).toHaveScreenshot("map-mobile-pub-selected.png", { animations: "disabled" });
      }
      await back.click();
      await expect(sheet).toHaveAttribute("data-state", "medium");
      await handle.focus();
      await page.keyboard.press("End");
      await expect(sheet).toHaveAttribute("data-state", "expanded");
      await page.locator(".pub-results-scroll").evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      await expect(sheet).toHaveAttribute("data-state", "expanded");
      if (width === 390 && locale === "ja") {
        await expect(page).toHaveScreenshot("map-mobile-bottom-sheet-expanded.png", { animations: "disabled" });
      }
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
      // ハンドルのみをドラッグして一段階縮小します。
      const handleBox = (await handle.boundingBox())!;
      await page.mouse.move(width / 2, handleBox.y + 20);
      await page.mouse.down();
      await page.mouse.move(width / 2, handleBox.y + 70, { steps: 8 });
      await page.mouse.up();
      await expect(sheet).toHaveAttribute("data-state", "medium");
      await results.getByRole("button", { name: t.list.closeResults }).click();
      await expect(sheet).toHaveAttribute("data-state", "collapsed");
      await expect(page.locator(".map-result-count")).toBeFocused();
      await page.locator(".filter-toggle").click();
      await page
        .getByRole("combobox", { name: t.explorer.prefecture, exact: true })
        .selectOption(locale === "ja" ? "東京都" : "Tokyo");
      await expect(page.locator(".filter-toggle-count")).toHaveText("1");
      await page.keyboard.press("Escape");
      await search.fill("no matching pub");
      await handle.click();
      await expect(results.getByRole("heading", { name: t.list.noResults })).toBeVisible();
      await results.getByRole("button", { name: t.explorer.resetFilters }).click();
      await expect(search).toHaveValue("");
      await expect(search).toBeFocused();
      // ソフトウェアキーボード・横向き相当の利用可能領域。OSキーボードそのものは実機確認対象です。
      for (const viewport of [
        { width, height: 420 },
        { width: 844, height: 390 },
        { width, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        await expect(search).toBeInViewport();
        await expect(handle).toBeInViewport();
        expect(
          await page.evaluate(
            () =>
              document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
          ),
        ).toBe(false);
      }
      await results.getByRole("button", { name: t.list.closeResults }).click();
      await context.grantPermissions(["geolocation"]);
      await context.setGeolocation({ latitude: 35.681, longitude: 139.767 });
      await page.getByRole("button", { name: t.explorer.currentLocationAction, exact: true }).click();
      await expect(page.getByText(t.explorer.currentLocationSuccess, { exact: true })).toBeInViewport();
      await expect(page.locator(".current-location-marker")).toHaveCount(1);
      await expect(sheet).toHaveAttribute("data-state", "collapsed");
      expect(errors).toEqual([]);
    });
  }
}
