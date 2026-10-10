import { expect, test } from "@playwright/test";
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
  await releaseInfo.scrollIntoViewIfNeeded();
  await expect(releaseInfo).toBeInViewport();
});

test("360px Mobile Navigation can open and reach every area and Sign out", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await loginAsE2EAdmin(page, "/admin/pubs");

  const menu = page.getByRole("button", { name: "管理メニュー" });
  await expect(menu).toBeVisible();
  await menu.click();
  const navigation = page.getByRole("navigation", { name: "管理機能" });
  for (const { label } of adminPages) {
    await expect(navigation.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await expect(navigation.getByRole("button", { name: "ログアウト" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "リリース情報" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
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
