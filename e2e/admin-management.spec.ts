import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { E2E_TEST_DATA } from "../apps/web/app/lib/e2e-test-fixtures";
import { loginAsE2EAdmin } from "./support/page-helpers";

test("Pubs・Tags・Statuses管理画面は日英とDesktop・Mobileで横overflowせず表示できる", async ({ page }) => {
  await loginAsE2EAdmin(page, "/admin/pubs");

  const pages = [
    { path: "/admin/pubs", name: "pubs-list" },
    { path: "/admin/pubs/new", name: "pubs-new" },
    { path: `/admin/pubs/${E2E_TEST_DATA.pubs.nagoya.id}/edit`, name: "pubs-edit" },
    { path: "/admin/tags", name: "tags" },
    { path: "/admin/statuses", name: "statuses" },
  ];
  const viewports = [
    { width: 1440, height: 1000 },
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
    { width: 360, height: 780 },
  ];

  for (const locale of ["ja", "en"] as const) {
    await page.context().addCookies([{ name: "irishpub-map-locale", value: locale, url: "http://localhost:3100" }]);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);

      for (const route of pages) {
        await page.goto(route.path);
        await expect(page.locator("h1")).toBeVisible();

        const dimensions = await page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }));
        expect(dimensions.documentWidth, `${locale} ${route.name} at ${viewport.width}px`).toBeLessThanOrEqual(
          dimensions.viewportWidth,
        );

        if (viewport.width === 1280 || viewport.width === 390) {
          if (route.name === "pubs-list") {
            const timestamps = page.locator(".admin-pub-table time");
            await expect(timestamps).toHaveCount(2);
            await expect(timestamps.first()).toHaveAttribute("datetime", "2026-01-15T12:00:00.000Z");
            await expect(timestamps.first()).toContainText(locale === "ja" ? "21:00" : "9:00 PM");

            // 日時は上で実表示を検証し、既存の画像比較では日付のみへ正規化する。
            // 見た目の基準画像を変更せず、店舗一覧のレイアウト回帰を継続検出する。
            await timestamps.evaluateAll((elements, renderLocale) => {
              for (const element of elements) {
                const updatedAt = element.getAttribute("datetime");
                if (updatedAt) {
                  element.textContent = new Intl.DateTimeFormat(renderLocale, { dateStyle: "medium" }).format(
                    new Date(updatedAt),
                  );
                }
              }
            }, locale);
          }

          await expect(page).toHaveScreenshot(`admin-${route.name}-${locale}-${viewport.width}.png`, {
            fullPage: true,
          });
          if (route.name === "pubs-edit") {
            const accessibility = await new AxeBuilder({ page }).analyze();
            expect(
              accessibility.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
            ).toEqual([]);
          }
        }
      }
    }
  }
});
