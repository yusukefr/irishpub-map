import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { E2E_TEST_DATA } from "../apps/web/app/lib/e2e-test-fixtures";
import { getGuideUrl, getPubUrl } from "../apps/web/app/lib/public-url";
import { mockExternalMapStyle } from "./support/page-helpers";

for (const locale of ["ja", "en"] as const) {
  for (const width of [1440, 390, 360]) {
    test(`public sharing ${locale} ${width}`, async ({ page, context }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await context.addCookies([{ name: "irishpub-map-locale", value: locale, domain: "localhost", path: "/" }]);
      await page.setViewportSize({ width, height: 900 });
      await mockExternalMapStyle(page);
      // OSのUI自体は自動化せず、クリックで渡されたpayloadとfallbackを検証します。
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async (data: ShareData) => {
            document.documentElement.dataset.shared = JSON.stringify(data);
          },
        });
      });
      const pub = E2E_TEST_DATA.pubs.tokyo;
      await page.goto(`/?pub=${pub.id}&source=ignored`);
      await expect(page.locator(".pub-detail-view")).toContainText(pub.name);
      const share = page.getByRole("button", { name: locale === "ja" ? "共有する" : "Share", exact: true });
      await share.focus();
      await expect(share).toBeFocused();
      await expect(share).toHaveCSS("outline-style", "solid");
      await share.press("Enter");
      await expect(page.locator("html")).toHaveAttribute(
        "data-shared",
        JSON.stringify({ title: pub.name, text: `${pub.name} | Irish Pub Map`, url: getPubUrl(pub.id) }),
      );
      const box = (await share.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: testInfo.outputPath("pub-share.png") });

      await page.goto("/discover/guides/split-the-g?source=ignored");
      await share.click();
      const title = await page.getByRole("heading", { level: 1 }).innerText();
      await expect(page.locator("html")).toHaveAttribute(
        "data-shared",
        JSON.stringify({ title, url: getGuideUrl("split-the-g") }),
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", getGuideUrl("split-the-g"));
      // API非対応時はページを再読み込みし、hydration後のラベルとコピーを確認します。
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: {
            writeText: async (url: string) => {
              document.documentElement.dataset.copied = url;
            },
          },
        });
      });
      await page.reload();
      await page.getByRole("button", { name: locale === "ja" ? "URLをコピー" : "Copy URL" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-copied", getGuideUrl("split-the-g"));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual(
        [],
      );
      await page.screenshot({ path: testInfo.outputPath("guide-share.png") });
      expect(errors).toEqual([]);
    });
  }
}
