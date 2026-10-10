import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { getTranslation } from "../apps/web/app/lib/i18n";
import { mockExternalMapStyle } from "./support/page-helpers";

/** CDPのtouch列でCarouselを横へ動かし、scrollLeft代入では拾えないgesture競合を確認します。 */
async function swipeCarouselLeft(
  page: import("@playwright/test").Page,
  context: import("@playwright/test").BrowserContext,
) {
  const box = (await page.getByRole("region", { name: /店舗カード一覧|Pub cards/ }).boundingBox())!;
  const client = await context.newCDPSession(page);
  const start = { x: box.x + box.width * 0.8, y: box.y + box.height / 2 };
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  for (let step = 1; step <= 10; step += 1) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: start.x - (box.width * 0.7 * step) / 10, y: start.y }],
    });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

for (const locale of ["ja", "en"] as const) {
  for (const width of [390, 360] as const) {
    test(`Mobile carousel and marker synchronization ${locale} ${width}`, async ({ context, page }) => {
      const t = getTranslation(locale);
      await context.addCookies([{ name: "irishpub-map-locale", value: locale, domain: "localhost", path: "/" }]);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await mockExternalMapStyle(page);
      await page.goto("/");
      const sheet = page.locator("section[data-state]");
      const carousel = page.getByRole("region", { name: t.list.carouselLabel });
      const cards = carousel.locator("article");
      const markers = page.locator(".pub-map-marker");
      await expect(markers).toHaveCount(2);
      await markers.first().focus();
      await page.keyboard.press("Enter");
      await expect(sheet).toHaveAttribute("data-state", "collapsed");
      await expect(cards.first()).toHaveAttribute("data-selected", "true");
      await expect(markers.first()).toHaveAttribute("aria-pressed", "true");
      await expect(markers.first()).toBeFocused();
      await page.locator(".map-workspace canvas").click({ position: { x: 10, y: 200 } });
      await expect(page.locator(".maplibregl-popup")).toHaveCount(0);
      const secondBefore = (await markers.nth(1).boundingBox())!;

      await swipeCarouselLeft(page, context);
      await expect(cards.nth(1)).toHaveAttribute("data-selected", "true");
      await expect(cards.nth(1).locator("button[aria-pressed]")).toHaveAttribute("aria-pressed", "true");
      await expect(markers.nth(1)).toHaveAttribute("aria-pressed", "true");
      await expect(markers.first()).toHaveAttribute("aria-pressed", "false");
      await expect(sheet).toHaveAttribute("data-state", "collapsed");
      await expect
        .poll(async () => {
          const secondAfter = (await markers.nth(1).boundingBox())!;
          return Math.abs(secondAfter.x - secondBefore.x) + Math.abs(secondAfter.y - secondBefore.y);
        })
        .toBeGreaterThan(20);
      const map = (await page.locator(".map-canvas").boundingBox())!;
      await expect
        .poll(async () => {
          const marker = (await markers.nth(1).boundingBox())!;
          return Math.hypot(
            marker.x + marker.width / 2 - (map.x + map.width / 2),
            marker.y + marker.height - (map.y + map.height / 2),
          );
        })
        .toBeLessThan(60);
      if (width === 390) {
        await expect(page).toHaveScreenshot(`map-mobile-carousel-selected-${locale}.png`, {
          animations: "disabled",
          mask: [page.locator(".app-version-number"), page.locator(".app-version-release-date")],
        });
      }
      const axe = await new AxeBuilder({ page }).analyze();
      expect(axe.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);

      await markers.first().focus();
      await page.keyboard.press("Enter");
      await expect(cards.first()).toHaveAttribute("data-selected", "true");
      await expect.poll(() => carousel.evaluate((node) => node.scrollLeft)).toBe(0);
      await expect(sheet).toHaveAttribute("data-state", "collapsed");
      await expect(markers.first()).toBeFocused();
      await page.waitForTimeout(300);
      await expect(cards.first()).toHaveAttribute("data-selected", "true");
      await expect(page.locator('.pub-map-marker[aria-pressed="true"]')).toHaveCount(1);

      await cards.first().locator("button[aria-pressed]").focus();
      await expect(cards.first().locator("button[aria-pressed]")).toHaveCSS("outline-width", "3px");
      await page.keyboard.press("Enter");
      await expect(sheet).toHaveAttribute("data-state", "medium");
      const resultsScroll = page.locator(".pub-results-scroll");
      const resultsBox = (await resultsScroll.boundingBox())!;
      const client = await context.newCDPSession(page);
      const start = { x: resultsBox.x + resultsBox.width / 2, y: resultsBox.y + resultsBox.height * 0.75 };
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
      for (let step = 1; step <= 8; step += 1) {
        await client.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: start.x, y: start.y - (resultsBox.height * 0.5 * step) / 8 }],
        });
      }
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect.poll(() => resultsScroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
      await expect(sheet).toHaveAttribute("data-state", "medium");
    });
  }
}

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
      const carousel = page.getByRole("region", { name: t.list.carouselLabel });
      const handle = page.getByRole("button", { name: new RegExp(t.explorer.resizeSheet) });
      const search = page.getByRole("searchbox", { name: t.explorer.searchLabel });
      await expect(page.locator(".pub-map-marker")).toHaveCount(2);
      await expect(sheet).toHaveAttribute("data-state", "collapsed");
      expect((await sheet.boundingBox())!.height).toBeLessThan(300);
      await expect(carousel.locator("article")).toHaveCount(2);
      expect(await carousel.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
      expect(await carousel.evaluate((element) => getComputedStyle(element).scrollSnapType)).toBe("x mandatory");
      expect((await carousel.locator("article").nth(1).boundingBox())!.x).toBeLessThan(width);
      await carousel.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      await expect.poll(() => carousel.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      await expect(page.locator('article[data-density="compact"][data-selected="true"]')).toHaveCount(1);
      await expect(page.locator(".pub-map-marker-selected")).toHaveCount(1);
      await carousel.evaluate((element) => {
        element.scrollLeft = 0;
      });
      await expect(carousel.locator('article[data-selected="true"]')).toHaveCount(1);
      const pubName = carousel.locator('article [role="heading"]').first();
      const originalName = await pubName.textContent();
      await pubName.evaluate(
        (element, name) => {
          element.textContent = name;
        },
        locale === "ja"
          ? "とても長い名前のアイリッシュパブと音楽と料理を楽しむお店"
          : "A Very Long Irish Pub Name for Music Food and Friends",
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await carousel.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
      await pubName.evaluate((element, name) => {
        element.textContent = name;
      }, originalName);
      await expect(search).toBeInViewport();
      const filterBox = (await page.locator(".filter-toggle").boundingBox())!;
      const locationBox = (await page.getByRole("button", { name: t.explorer.currentLocationAction }).boundingBox())!;
      expect(locationBox.x).toBeGreaterThanOrEqual(filterBox.x + filterBox.width);
      expect(locationBox.x + locationBox.width).toBeLessThanOrEqual(width);
      const menu = page.locator(".app-header summary");
      await menu.click();
      await expect(page.getByRole("link", { name: t.discover.navigation, exact: true })).toBeVisible();
      await menu.click();
      if (width === 390) {
        await expect(page).toHaveScreenshot(`map-mobile-${locale}.png`, {
          animations: "disabled",
          mask: [page.locator(".app-version-number"), page.locator(".app-version-release-date")],
        });
      }
      for (const button of await page.locator(".pub-map-marker, .maplibregl-ctrl-group button").all()) {
        const box = (await button.boundingBox())!;
        // CSS上の44pxがサブピクセル計算で僅かに小さく返る環境差を許容します。
        expect(box.width).toBeGreaterThanOrEqual(43.99);
        expect(box.height).toBeGreaterThanOrEqual(43.99);
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
      await expect(sheet).toHaveAttribute("data-state", "collapsed");
      await expect(page.locator('article[data-density="compact"][data-selected="true"]')).toHaveCount(1);
      await expect(page.locator(".pub-results-panel")).toHaveCount(0);
      await carousel
        .locator('article[data-selected="true"]')
        .getByRole("button", { name: t.list.details, exact: true })
        .click();
      await expect(sheet).toHaveAttribute("data-state", "expanded");
      const back = page.getByRole("button", { name: new RegExp(t.list.backToResults) });
      await expect(back).toBeFocused();
      if (width === 390 && locale === "ja") {
        await expect(page).toHaveScreenshot("map-mobile-pub-selected.png", {
          animations: "disabled",
          mask: [page.locator(".app-version-number"), page.locator(".app-version-release-date")],
        });
      }
      await back.click();
      await expect(sheet).toHaveAttribute("data-state", "collapsed");
      await expect(carousel.locator('article[data-selected="true"]')).toHaveCount(1);
      await page.locator(".map-result-count").click();
      await expect(sheet).toHaveAttribute("data-state", "medium");
      await expect(page.locator('.pub-results-panel article[data-selected="true"]')).toHaveCount(1);
      await canvas.click({ position: { x: 10, y: 240 } });
      if (width === 390 && locale === "ja") {
        // Pan/pinchで位置が変動する地図マーカーは、このSheetのVisual Regression対象から除外します。
        // 代わりに凡例がSheetの上に収まっていることを位置で検証します。
        const legend = page.locator(".pub-map-legend");
        await expect(legend).toBeVisible();
        const legendBox = (await legend.boundingBox())!;
        const sheetBox = (await sheet.boundingBox())!;
        expect(legendBox.y + legendBox.height).toBeLessThanOrEqual(sheetBox.y);
        await expect(sheet).toHaveScreenshot("map-mobile-bottom-sheet-medium.png", {
          animations: "disabled",
          maxDiffPixels: 200,
        });
      }
      const results = page.locator(".pub-results-panel");
      await results
        .locator('article[data-selected="true"]')
        .getByRole("button", { name: t.list.details, exact: true })
        .click();
      await expect(sheet).toHaveAttribute("data-state", "expanded");
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
        await expect(page).toHaveScreenshot("map-mobile-bottom-sheet-expanded.png", {
          animations: "disabled",
          mask: [page.locator(".app-version-number"), page.locator(".app-version-release-date")],
        });
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
      await expect(page.locator('article[data-density="compact"][data-selected="true"]')).toHaveCount(1);
      await search.fill("no matching pub");
      await expect(page.locator('article[data-density="compact"][data-selected="true"]')).toHaveCount(0);
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
      await expect(sheet).toHaveAttribute("data-state", "collapsed");
      await carousel.evaluate((element) => {
        element.scrollLeft = element.scrollWidth;
      });
      await expect.poll(() => carousel.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      const secondCard = carousel.locator("article").nth(1);
      await expect(secondCard).toHaveAttribute("data-selected", "true");
      const carouselScrollLeft = await carousel.evaluate((element) => element.scrollLeft);
      const selectedCardName = await secondCard.locator('[role="heading"]').textContent();
      await secondCard.getByRole("button", { name: t.list.details, exact: true }).click();
      await expect(sheet).toHaveAttribute("data-state", "expanded");
      await expect(back).toBeFocused();
      await back.click();
      await expect(sheet).toHaveAttribute("data-state", "collapsed");
      await expect.poll(() => carousel.evaluate((element) => element.scrollLeft)).toBe(carouselScrollLeft);
      await expect(carousel.locator('article[data-selected="true"]')).toHaveCount(1);
      await expect(carousel.locator('article[data-selected="true"] [role="heading"]')).toHaveText(selectedCardName!);
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
