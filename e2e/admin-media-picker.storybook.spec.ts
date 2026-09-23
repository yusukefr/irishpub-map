import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { E2E_TEST_DATA } from "../apps/web/app/lib/e2e-test-fixtures";

test("Media Picker card has a separate keyboard control and accessible dialog", async ({ page }) => {
  const asset = E2E_TEST_DATA.media.landscape;
  await page.route(/\/api\/admin\/media\?page=1$/, (route) =>
    route.fulfill({
      json: {
        media: [asset],
        total: 1,
        page: 1,
        pageSize: 50,
        databaseConfigured: true,
        storageConfigured: true,
      },
    }),
  );
  await page.route("**/media-fixtures/landscape.jpg", (route) =>
    route.fulfill({ path: "apps/web/public/media-fixtures/landscape.jpg", contentType: "image/jpeg" }),
  );
  await page.goto("/iframe.html?id=admin-mediapicker--default&viewMode=story");

  const trigger = page.getByRole("button", { name: "画像を選択" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "画像を選択" });
  await expect(dialog).toBeVisible();

  const select = dialog.getByRole("button", { name: new RegExp(asset.id) });
  await expect(select).toBeVisible();
  await expect(select.locator("dl")).toHaveCount(0);
  await expect(select.locator("..").locator("dl")).toBeVisible();
  await select.focus();
  await page.keyboard.press("Space");
  await expect(select).toHaveAttribute("aria-pressed", "true");
  await expect(select).toContainText("選択中");

  const accessibility = await new AxeBuilder({ page }).include("dialog").analyze();
  expect(accessibility.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
  await dialog.getByRole("button", { name: "選択した画像を使う" }).click();
  await expect(trigger).toBeFocused();
});
