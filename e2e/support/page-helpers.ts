import { expect, type Page } from "@playwright/test";
import { E2E_ADMIN_CREDENTIALS } from "./test-values";

const EMPTY_MAP_STYLE = { version: 8 as const, sources: {}, layers: [] };

/** OpenFreeMapの外部スタイルを最小styleへ置き換え、E2Eを外部サービスから分離します。 */
export async function mockExternalMapStyle(page: Page): Promise<void> {
  await page.route("https://tiles.openfreemap.org/styles/bright*", async (route) => {
    await route.fulfill({ contentType: "application/json", json: EMPTY_MAP_STYLE });
  });
}

/** 管理画面の実ログインフローを通過し、指定した保護画面へ移動します。 */
export async function loginAsE2EAdmin(page: Page, destination: string): Promise<void> {
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "ID" }).fill(E2E_ADMIN_CREDENTIALS.username);
  await page.getByLabel("パスワード").fill(E2E_ADMIN_CREDENTIALS.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/admin\/pubs$/);
  await page.goto(destination);
}
