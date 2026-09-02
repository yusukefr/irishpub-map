import { expect, test } from "@playwright/test";
import { E2E_TEST_DATA } from "../apps/web/app/lib/e2e-test-fixtures";
import { loginAsE2EAdmin } from "./support/page-helpers";

test("ログイン後に管理店舗一覧から固定店舗の編集フォームへ移動する", async ({ page }) => {
  await loginAsE2EAdmin(page, "/admin/pubs");

  await expect(page.getByRole("heading", { name: "店舗管理" })).toBeVisible();
  const row = page.getByRole("row", { name: new RegExp(E2E_TEST_DATA.pubs.nagoya.name) });
  await row.getByRole("link", { name: "編集" }).click();

  await expect(page.getByRole("heading", { name: "店舗を編集" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "店舗名", exact: true })).toHaveValue(E2E_TEST_DATA.pubs.nagoya.name);
  await expect(page.getByRole("button", { name: "更新" })).toBeVisible();
});
