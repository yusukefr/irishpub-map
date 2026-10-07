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

  const logout = page.getByRole("button", { name: "ログアウト" });
  await logout.scrollIntoViewIfNeeded();
  await expect(logout).toBeInViewport();

  const releaseInfo = page.getByRole("complementary", { name: "リリース情報" });
  await releaseInfo.scrollIntoViewIfNeeded();
  await expect(releaseInfo).toBeInViewport();
});
