import { expect, test } from "@playwright/test";
import { loginAsE2EAdmin } from "./support/page-helpers";

test("ログイン後にタグ管理の固定一覧と操作ラベルを表示する", async ({ page }) => {
  await loginAsE2EAdmin(page, "/admin/tags");

  await expect(page.getByRole("heading", { name: "タグ管理" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "登録タグ（2件）" })).toBeVisible();
  await expect(page.getByText("ギネス", { exact: true })).toBeVisible();
  await expect(page.getByText("ウイスキー", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "編集" })).toHaveCount(2);
});
