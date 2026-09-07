import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mockExternalMapStyle } from "./support/page-helpers";

const seriousOrCritical = (impact: string | null | undefined) => impact === "critical" || impact === "serious";

/** 公開画面で自動検出できる重大なアクセシビリティ違反を防止します。 */
test("公開Mapにcritical/seriousなaxe違反がない", async ({ page }) => {
  await mockExternalMapStyle(page);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Irish Pub の地図と一覧" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => seriousOrCritical(violation.impact))).toEqual([]);
});

test("Discoverにcritical/seriousなaxe違反がない", async ({ page }) => {
  await page.goto("/discover");
  await expect(page.getByRole("heading", { level: 1, name: "Explore Ireland" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => seriousOrCritical(violation.impact))).toEqual([]);
});
