import { expect, test } from "@playwright/test";
import { mockExternalMapStyle } from "./support/page-helpers";

test("英語選択をcookieへ保存し、同じURLの再読み込み後も維持する", async ({ context, page }) => {
  await mockExternalMapStyle(page);
  await page.goto("/");

  await page.getByRole("button", { name: "表示言語: 日本語" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("searchbox", { name: "Search pubs" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Language: English" })).toBeVisible();
  await expect
    .poll(async () => (await context.cookies()).find((cookie) => cookie.name === "irishpub-map-locale")?.value)
    .toBe("en");

  await page.reload();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("searchbox", { name: "Search pubs" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Language: English" })).toBeVisible();
});
