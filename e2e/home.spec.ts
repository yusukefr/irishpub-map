import { expect, test } from "@playwright/test";
import { mockExternalMapStyle } from "./support/page-helpers";

test("Homeの主要な探索UIを表示する", async ({ page }) => {
  await mockExternalMapStyle(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Irish Pub Map" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Irish Pub の地図と一覧" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "店舗を検索" })).toBeVisible();
  await expect(page.getByRole("button", { name: "条件を指定" })).toBeVisible();
  await expect(page.getByRole("button", { name: "現在地から探す" })).toBeVisible();
  await expect(page.getByRole("button", { name: "2件のPubが見つかりました" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Map" })).toBeVisible();
});
