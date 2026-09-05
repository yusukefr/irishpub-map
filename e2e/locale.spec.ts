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

test("Split the Gの実MDXを日英表示し、Mapへの導線を維持する", async ({ page }) => {
  await page.goto("/discover/guides/split-the-g");

  await expect(page.getByRole("heading", { level: 1, name: "Split the Gを楽しむ" })).toBeVisible();
  await expect(page.getByText("地域や一緒に楽しむ人によって判定方法は異なります。", { exact: false })).toBeVisible();
  await expect(
    page.getByText("Split the Gは、成功や飲む速さ・量を競うものではありません。", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Irish Pubを探す →" })).toHaveAttribute("href", "/");

  await page.getByRole("button", { name: "表示言語: 日本語" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "How to Enjoy Split the G" })).toBeVisible();
  await expect(
    page.getByText("How the result is judged varies between places and groups.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Split the G is not about drinking quickly or drinking more.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Find an Irish pub →" })).toHaveAttribute("href", "/");
});
