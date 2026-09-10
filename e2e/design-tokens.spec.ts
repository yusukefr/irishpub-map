import { expect, test } from "@playwright/test";
import { mockExternalMapStyle } from "./support/page-helpers";

// CSS文字列だけでは検出できない後段の上書きと、ビルド後の変数脱落を実ブラウザで検査します。
for (const locale of ["ja", "en"] as const) {
  for (const width of [1440, 1280, 390, 360]) {
    test(`Public tokens and layout: ${locale} ${width}px`, async ({ context, page }, testInfo) => {
      await context.addCookies([{ name: "irishpub-map-locale", value: locale, domain: "localhost", path: "/" }]);
      await page.setViewportSize({ width, height: width >= 1280 ? 900 : 844 });
      await mockExternalMapStyle(page);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const path of ["/", "/discover"]) {
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        const computed = await page.evaluate(() => {
          const body = getComputedStyle(document.body);
          const root = getComputedStyle(document.documentElement);
          const uiFont = root.getPropertyValue("--font-ui").trim();
          const family = uiFont.split(",")[0].trim().replace(/["']/g, "");
          return {
            background: body.backgroundColor,
            color: body.color,
            font: body.fontFamily,
            family,
            loaded: [...document.fonts].some(
              (font) => font.family.replace(/["']/g, "") === family && font.status === "loaded",
            ),
            overflow: document.documentElement.scrollWidth > window.innerWidth,
          };
        });
        expect(computed.background).toBe("rgb(247, 243, 234)");
        expect(computed.color).toBe("rgb(24, 33, 29)");
        expect(computed.family).not.toBe("");
        expect(computed.font).toContain(computed.family);
        expect(computed.loaded).toBe(true);
        expect(computed.overflow).toBe(false);
        if (path === "/") {
          const mapControls = page.locator(".maplibregl-ctrl-group");
          await expect(mapControls).toBeVisible();
          const mapRect = (await mapControls.boundingBox())!;
          for (const control of await page
            .locator(".map-search-controls-toolbar input, .map-search-controls-toolbar button")
            .all()) {
            const rect = (await control.boundingBox())!;
            // 地図操作と探索操作は、縦横のどちらかで完全に離れていれば重なりません。
            // 右端に縦並びのMapLibre操作を置くMobileでは、片軸だけの比較では誤検知します。
            expect(
              rect.x + rect.width <= mapRect.x ||
                mapRect.x + mapRect.width <= rect.x ||
                rect.y + rect.height <= mapRect.y ||
                mapRect.y + mapRect.height <= rect.y,
            ).toBe(true);
          }
          for (const button of await mapControls.getByRole("button").all()) {
            const rect = (await button.boundingBox())!;
            expect(rect.width).toBeGreaterThanOrEqual(44);
            expect(rect.height).toBeGreaterThanOrEqual(44);
          }
          const locationButton = page.locator(".current-location-control > button");
          expect((await locationButton.boundingBox())!.height).toBeLessThanOrEqual(88);
        }
        await page.screenshot({
          path: testInfo.outputPath(`${path === "/" ? "map" : "discover"}.png`),
          fullPage: true,
        });

        // 見た目が偶然同じでも、Token変更がbodyへ伝わらない場合は失敗します。
        await page.evaluate(() => {
          document.documentElement.style.setProperty("--color-surface-page", "rgb(1, 2, 3)");
          document.documentElement.style.setProperty("--color-text-primary", "rgb(4, 5, 6)");
        });
        await expect(page.locator("body")).toHaveCSS("background-color", "rgb(1, 2, 3)");
        await expect(page.locator("body")).toHaveCSS("color", "rgb(4, 5, 6)");
      }
      expect(errors).toEqual([]);
    });
  }
}

test("focus and typography use the compiled Design Tokens", async ({ page }) => {
  await mockExternalMapStyle(page);
  await page.goto("/");
  const search = page.getByRole("searchbox").first();
  await search.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(search).toBeFocused();
  await expect(search).toHaveCSS("outline-color", "rgb(23, 92, 211)");
  await expect(search).toHaveCSS("outline-width", "3px");
  await expect(search).toHaveCSS("outline-offset", "3px");
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--focus-ring-width", "5px");
    document.documentElement.style.setProperty("--color-focus-ring", "rgb(10, 20, 30)");
  });
  await expect(search).toHaveCSS("outline-width", "5px");
  await expect(search).toHaveCSS("outline-color", "rgb(10, 20, 30)");

  const typography = await page.evaluate(() => {
    const sample = document.createElement("span");
    sample.style.fontSize = "var(--text-heading-md)";
    sample.style.lineHeight = "var(--text-heading-md--line-height)";
    sample.style.fontWeight = "var(--text-heading-md--font-weight)";
    document.body.append(sample);
    const style = getComputedStyle(sample);
    const result = [style.fontSize, style.lineHeight, style.fontWeight];
    sample.remove();
    return result;
  });
  expect(typography).toEqual(["24px", "31.2px", "700"]);
});
