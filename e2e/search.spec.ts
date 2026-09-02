import { expect, test } from "@playwright/test";
import { E2E_TEST_DATA } from "../apps/web/app/lib/e2e-test-fixtures";
import { mockExternalMapStyle } from "./support/page-helpers";

test("店舗名検索から対象店舗だけを結果一覧へ表示する", async ({ page }) => {
  await mockExternalMapStyle(page);
  await page.goto("/");

  await page.getByRole("searchbox", { name: "店舗を検索" }).fill(E2E_TEST_DATA.pubs.nagoya.name);
  await expect(page.getByRole("button", { name: "1件のPubが見つかりました" })).toBeVisible();
  await page.getByRole("button", { name: "1件のPubが見つかりました" }).click();

  const results = page.getByRole("complementary", { name: "掲載店舗" });
  await expect(results.getByText(E2E_TEST_DATA.pubs.nagoya.name)).toBeVisible();
  await expect(results.getByText(E2E_TEST_DATA.pubs.tokyo.name)).toHaveCount(0);
});
