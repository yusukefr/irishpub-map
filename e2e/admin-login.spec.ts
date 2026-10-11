import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { LOCALE_COOKIE } from "../apps/web/app/lib/i18n";

const viewports = [
  { width: 1440, height: 900, snapshot: true },
  { width: 1280, height: 800, snapshot: false },
  { width: 390, height: 844, snapshot: true },
  { width: 360, height: 800, snapshot: false },
] as const;

for (const locale of ["ja", "en"] as const) {
  for (const viewport of viewports) {
    test(`管理者ログイン ${locale} ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.context().addCookies([{ name: LOCALE_COOKIE, value: locale, url: "http://localhost:3100" }]);
      await page.goto("/admin/login");

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByLabel("ID")).toBeVisible();
      await expect(page.getByLabel(locale === "ja" ? "パスワード" : "Password")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual(
        [],
      );

      if (viewport.snapshot) {
        await expect(page).toHaveScreenshot(`admin-login-${locale}-${viewport.width}.png`, {
          fullPage: true,
        });
      }
    });
  }
}

test("ログイン失敗を通知し、入力値を保持する", async ({ page }) => {
  await page.route("**/api/admin/login", async (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ errorCode: "invalid_credentials" }),
    }),
  );
  await page.goto("/admin/login");
  await page.getByLabel("ID").fill("playwright-admin");
  await page.getByLabel("パスワード").fill("playwright-test-password");
  await page.getByRole("button", { name: "ログイン" }).click();

  await expect(page.locator(".admin-error")).toHaveText("ID またはパスワードが正しくありません。");
  await expect(page.getByLabel("ID")).toHaveValue("playwright-admin");
  await expect(page.getByLabel("パスワード")).toHaveValue("playwright-test-password");
});
