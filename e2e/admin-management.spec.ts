import { expect, test } from "@playwright/test";
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
          await expect(page).toHaveScreenshot(`admin-${route.name}-${locale}-${viewport.width}.png`, {
            fullPage: true,
          });
        }
      }
    }
  }
});
