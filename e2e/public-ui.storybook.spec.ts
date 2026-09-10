import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const locale of ["japanese", "english"]) {
  for (const width of [1440, 1280, 390, 360]) {
    test(`Public UI: ${locale} ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`/iframe.html?id=design-system-public-ui--${locale}&viewMode=story`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Public UI Components");
      const geometry = await page.evaluate(() => {
        const controls = [...document.querySelectorAll("main button, main input, main a")].filter(
          (element) => element.getBoundingClientRect().height > 0,
        );
        return {
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          small: controls
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width < 44 || rect.height < 44;
            })
            .map((element) => element.outerHTML),
        };
      });
      expect(geometry.overflow).toBe(false);
      expect(geometry.small).toEqual([]);
      // 同じgrid行に写真付きカードがあっても、短いbadgeやtagを縦へ引き伸ばしません。
      for (const badge of await page.locator("article span[data-status], article li").all()) {
        expect((await badge.boundingBox())!.height).toBeLessThan(44);
      }
      const input = page.getByRole("searchbox").first();
      await input.focus();
      await page.keyboard.press("Tab");
      const clear = page.getByRole("button", {
        name: locale === "japanese" ? "検索をクリア" : "Clear search",
        exact: true,
      });
      await expect(clear).toBeFocused();
      await expect(clear).toHaveCSS("outline-width", "3px");
      await page.keyboard.press("Enter");
      await expect(input).toHaveValue("");
      await expect(input).toBeFocused();
      await expect(input).toHaveCSS("outline-width", "3px");
      const loading = page.getByTestId("loading-button");
      const before = await loading.boundingBox();
      const label = await loading.innerText();
      await loading.click();
      await expect(loading).toBeDisabled();
      await expect(loading).toHaveAccessibleName(label);
      expect((await loading.boundingBox())?.width).toBe(before?.width);
      const results = await new AxeBuilder({ page }).include("main").analyze();
      expect(results.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath("components.png"), fullPage: true });
      expect(errors).toEqual([]);
    });
  }
}

for (const suffix of ["desktop-pub-cards", "desktop-pub-cards-english"]) {
  test(`Compact PubCards: ${suffix}`, async ({ page }, testInfo) => {
    await page.goto(`/iframe.html?id=design-system-public-ui--${suffix}&viewMode=story`);
    const cards = page.locator('article[data-density="compact"]');
    await expect(cards).toHaveCount(4);
    for (const card of await cards.all()) {
      expect(await card.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      for (const button of await card.getByRole("button").all()) {
        const box = (await button.boundingBox())!;
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
    await cards.nth(2).locator("button[aria-pressed]").click();
    await expect(cards.nth(2)).toHaveAttribute("data-selected", "true");
    const axe = await new AxeBuilder({ page }).include("main").analyze();
    expect(axe.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("compact-cards.png"), fullPage: true });
  });
}

test("Bottom Sheet: keyboard, content scrolling, focus restoration and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/iframe.html?id=design-system-public-ui--bottom-sheet-states&viewMode=story");
  const sheet = page.locator("section[data-state]");
  const handle = page.getByRole("button", { name: /^高さを変更:/ });
  await expect(sheet).toHaveCSS("transition-duration", "0s");
  const body = sheet.locator('div[role="region"]');
  expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await handle.focus();
  await page.keyboard.press("End");
  await expect(sheet).toHaveAttribute("data-state", "expanded");
  await page.keyboard.press("Home");
  await expect(sheet).toHaveAttribute("data-state", "collapsed");
  await expect(body).toBeHidden();
  await page.keyboard.press("ArrowUp");
  await expect(sheet).toHaveAttribute("data-state", "medium");
  await sheet.getByRole("button", { name: "折りたたむ", exact: true }).click();
  await expect(handle).toBeFocused();
  await expect(sheet).toHaveAttribute("data-state", "collapsed");
});

test("Bottom Sheet: touch drag changes one state and preserves page scroll outside the handle", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto("/iframe.html?id=design-system-public-ui--bottom-sheet-states&viewMode=story");
    const handle = page.getByRole("button", { name: /^高さを変更:/ });
    await handle.scrollIntoViewIfNeeded();
    const rect = await handle.boundingBox();
    expect(rect).not.toBeNull();
    const client = await context.newCDPSession(page);
    const point = { x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 };
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, y: point.y - 70 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(page.locator("section[data-state]")).toHaveAttribute("data-state", "expanded");
    await expect(handle).toHaveCSS("touch-action", "none");
    await expect(page.locator('section[data-state] div[role="region"]')).toHaveCSS("touch-action", "auto");
  } finally {
    await context.close();
  }
});
