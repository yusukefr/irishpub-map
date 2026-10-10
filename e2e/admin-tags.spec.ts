import { expect, test } from "@playwright/test";
import { loginAsE2EAdmin } from "./support/page-helpers";

test("ログイン後にタグ管理の固定一覧と操作ラベルを表示する", async ({ page }) => {
  await loginAsE2EAdmin(page, "/admin/tags");

  await expect(page.getByRole("heading", { name: "タグ管理" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "新規登録" })).toBeVisible();
  await expect(page.getByRole("button", { name: "追加" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "登録タグ（2件）" })).toBeVisible();
  await expect(page.getByText("ギネス", { exact: true })).toBeVisible();
  await expect(page.getByText("ウイスキー", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "編集" })).toHaveCount(2);

  await page.getByRole("button", { name: "編集" }).first().click();
  await expect(page.getByRole("heading", { name: "タグを編集" })).toBeVisible();
  await expect(page.getByRole("button", { name: "更新" })).toBeVisible();
  await expect(page.getByRole("button", { name: "キャンセル" })).toBeVisible();

  await page.getByRole("button", { name: "キャンセル" }).click();
  await expect(page.getByRole("heading", { name: "新規登録" })).toBeVisible();
  await expect(page.getByRole("button", { name: "追加" })).toBeEnabled();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "新規登録" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新規登録" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
