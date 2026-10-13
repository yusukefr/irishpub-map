import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { LOCALE_COOKIE } from "../apps/web/app/lib/i18n";
import { loginAsE2EAdmin } from "./support/page-helpers";

const adminPages = [
  { label: "Pubs", path: "/admin/pubs" },
  { label: "Content", path: "/admin/content" },
  { label: "Media", path: "/admin/media" },
  { label: "Quiz", path: "/admin/quiz" },
  { label: "Calendar", path: "/admin/calendar" },
  { label: "Tags", path: "/admin/tags" },
  { label: "Statuses", path: "/admin/statuses" },
];

test("全管理画面で共通SidebarのログアウトとRelease Infoに到達できる", async ({ page }) => {
  await loginAsE2EAdmin(page, "/admin/pubs");

  for (const { label, path } of adminPages) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
    await expect(page.getByRole("button", { name: "ログアウト" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "リリース情報" })).toContainText("Version");
    await expect(page.getByRole("complementary", { name: "リリース情報" })).toContainText("Release Date");
    await expect(page.getByRole("complementary", { name: "リリース情報" })).toContainText("Git Commit");
  }

  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("低いMobile viewportでもSidebar下部へスクロールできる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 360 });
  await loginAsE2EAdmin(page, "/admin/pubs");
  await page.getByRole("button", { name: "管理メニュー" }).click();

  const logout = page.getByRole("button", { name: "ログアウト" });
  await logout.scrollIntoViewIfNeeded();
  await expect(logout).toBeInViewport();

  const releaseInfo = page.getByRole("complementary", { name: "リリース情報" });
  const releaseToggle = releaseInfo.getByRole("button", { name: /リリース情報/ });
  await expect(releaseToggle).toHaveAttribute("aria-expanded", "false");
  await releaseToggle.click();
  await expect(releaseToggle).toHaveAttribute("aria-expanded", "true");
  await expect(releaseInfo).toContainText("Git Commit");
  await releaseInfo.scrollIntoViewIfNeeded();
  await expect(releaseInfo).toBeInViewport();
});

test("360px Mobile Navigation can open and reach every area and Sign out", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await loginAsE2EAdmin(page, "/admin/pubs");

  const menu = page.getByRole("button", { name: "管理メニュー" });
  await expect(menu).toBeVisible();
  const releaseInfo = page.getByRole("complementary", { name: "リリース情報" });
  const releaseToggle = releaseInfo.getByRole("button", { name: /リリース情報/ });
  await expect(releaseToggle).toHaveAttribute("aria-expanded", "false");
  await expect(releaseToggle).toContainText("Version");
  const contentBounds = await page.locator(".admin-content").boundingBox();
  expect(contentBounds?.y).toBeLessThan(200);
  await expect(page.locator(".admin-sidebar")).toHaveScreenshot("admin-sidebar-mobile-collapsed-ja-360.png");
  const collapsedAxe = await new AxeBuilder({ page }).analyze();
  expect(collapsedAxe.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);

  await releaseToggle.focus();
  await page.keyboard.press("Enter");
  await expect(releaseToggle).toHaveAttribute("aria-expanded", "true");
  await expect(releaseInfo).toContainText("Git Commit");
  const expandedAxe = await new AxeBuilder({ page }).analyze();
  expect(expandedAxe.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
  await expect(page.locator(".admin-sidebar")).toHaveScreenshot("admin-sidebar-mobile-expanded-ja-360.png");

  await menu.click();
  const navigation = page.getByRole("navigation", { name: "管理機能" });
  for (const { label } of adminPages) {
    await expect(navigation.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await expect(navigation.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await expect(releaseInfo).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("English Mobile Release Information is keyboard accessible and retains all fields", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAsE2EAdmin(page, "/admin/pubs");
  await page.context().addCookies([{ name: LOCALE_COOKIE, value: "en", url: new URL(page.url()).origin }]);
  await page.reload();

  const releaseInfo = page.getByRole("complementary", { name: "Release Information" });
  const releaseToggle = releaseInfo.getByRole("button", { name: /Release Information/ });
  await expect(releaseToggle).toHaveAttribute("aria-expanded", "false");
  await expect(releaseToggle).toContainText("Version");
  await releaseToggle.focus();
  await page.keyboard.press("Enter");
  await expect(releaseToggle).toHaveAttribute("aria-expanded", "true");
  await expect(releaseInfo).toContainText("Release Date");
  await expect(releaseInfo).toContainText("Git Commit");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
});

test("360px Mobile Navigation stays closed after route changes and same-page navigation", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await loginAsE2EAdmin(page, "/admin/pubs");

  const menu = page.getByRole("button", { name: "管理メニュー" });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("navigation", { name: "管理機能" }).getByRole("link", { name: "Calendar", exact: true }).click();

  await expect(page).toHaveURL(/\/admin\/calendar$/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("navigation", { name: "管理機能" })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Calendar Event一覧" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/pubs$/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("navigation", { name: "管理機能" })).not.toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(/\/admin\/calendar$/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");

  await page.goBack();
  await expect(page).toHaveURL(/\/admin\/pubs$/);
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("navigation", { name: "管理機能" }).getByRole("link", { name: "Pubs", exact: true }).click();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("navigation", { name: "管理機能" })).not.toBeVisible();
});
