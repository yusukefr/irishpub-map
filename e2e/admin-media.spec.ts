import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { LOCALE_COOKIE } from "../apps/web/app/lib/i18n";
import { E2E_TEST_DATA } from "../apps/web/app/lib/e2e-test-fixtures";
import { loginAsE2EAdmin } from "./support/page-helpers";

test.use({ timezoneId: "Asia/Tokyo" });

test("Japanese Media管理画面にfixtureを表示する", async ({ page }) => {
  await loginAsE2EAdmin(page, "/admin/media");
  await expect(page.getByRole("heading", { name: "Media管理" })).toBeVisible();
  await expect(page.getByText(E2E_TEST_DATA.media.landscape.id)).toBeVisible();
  await expect(page.getByText("1200 × 800")).toBeVisible();
  await expect(page.getByRole("link", { name: "Media" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("button", { name: "アップロード" })).toBeDisabled();
  await expect(page).toHaveScreenshot("admin-media-desktop-ja.png", { fullPage: true });
});

test("English Media管理画面を表示しaxeで確認する", async ({ page }) => {
  await loginAsE2EAdmin(page, "/admin/media");
  await page.context().addCookies([{ name: LOCALE_COOKIE, value: "en", url: new URL(page.url()).origin }]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Media library" })).toBeVisible();
  await expect(page.getByText(E2E_TEST_DATA.media.portrait.id)).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
  await expect(page).toHaveScreenshot("admin-media-desktop-en.png", { fullPage: true });
});

test("Mobile Media Grid remains usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsE2EAdmin(page, "/admin/media");
  await expect(page.getByText(E2E_TEST_DATA.media.landscape.id)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page).toHaveScreenshot("admin-media-mobile-ja.png", { fullPage: true });
});

test("unauthenticated users are redirected away from Media management", async ({ page }) => {
  await page.goto("/admin/media");
  await expect(page).toHaveURL(/\/admin\/login/);
});
