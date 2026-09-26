import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { E2E_TEST_DATA } from "../apps/web/app/lib/e2e-test-fixtures";

async function useLocale(context: BrowserContext, locale: "ja" | "en"): Promise<void> {
  await context.addCookies([
    {
      name: "irishpub-map-locale",
      value: locale,
      domain: "localhost",
      path: "/",
    },
  ]);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth);
}

test.describe("Discover editorial pages", () => {
  test("Draftと存在しないGuideは404にする", async ({ page }) => {
    for (const slug of ["e2e-draft-guide", "not-exist"]) {
      const response = await page.goto("/discover/guides/" + slug);
      expect(response?.status()).toBe(404);
    }
  });

  for (const scenario of [
    { locale: "ja" as const, width: 1440, height: 900 },
    { locale: "en" as const, width: 1280, height: 900 },
    { locale: "ja" as const, width: 390, height: 844 },
    { locale: "en" as const, width: 360, height: 800 },
  ]) {
    test(scenario.locale + " " + scenario.width + "pxでトップの階層と導線を保つ", async ({ context, page }) => {
      await useLocale(context, scenario.locale);
      await page.setViewportSize({ width: scenario.width, height: scenario.height });
      await page.goto("/discover");

      await expect(page.getByRole("heading", { level: 1, name: "Explore Ireland" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "Guides" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 3 })).toHaveCount(3);
      await expect(page.getByRole("link", { name: /(?:物語を読む|Read story)/ })).toHaveAttribute(
        "href",
        "/discover/stories/e2e-pub-story",
      );
      const imageAlt = scenario.locale === "ja" ? "パブのテーブルに置かれたグラス" : "A glass on a pub table";
      const imageCard = page.locator('.discover-guide-section .discover-guide-grid [data-variant="image"]');
      await expect(imageCard.getByRole("img", { name: imageAlt })).toBeVisible();
      const compactCard = page.locator('.discover-guide-section .discover-guide-grid [data-variant="compact"]');
      await expect(compactCard).toHaveCount(1);
      expect((await compactCard.boundingBox())!.height).toBeLessThan((await imageCard.boundingBox())!.height);
      await expect(
        page.getByRole("link", {
          name: scenario.locale === "ja" ? "地図でIrish Pubを探す" : "Find an Irish pub on the map",
        }),
      ).toHaveAttribute("href", "/");
      await expectNoHorizontalOverflow(page);
    });
  }

  for (const locale of ["ja", "en"] as const) {
    test(locale + "のGuide Heroとcaptionを表示し、画像なしGuideは従来表示を保つ", async ({ context, page }) => {
      await useLocale(context, locale);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/discover/guides/split-the-g");
      const imageAlt = locale === "ja" ? "パブのテーブルに置かれたグラス" : "A glass on a pub table";
      const caption = locale === "ja" ? "パブで過ごす時間" : "Time at the pub";
      await expect(page.locator("figure.guide-hero").getByRole("img", { name: imageAlt })).toBeVisible();
      await expect(page.locator("figure.guide-hero figcaption")).toHaveText(caption);
      await expect(page.locator('link[rel="preload"][as="image"]')).toHaveCount(1);
      await expectNoHorizontalOverflow(page);

      await page.goto("/discover/guides/sample");
      await expect(page.locator("figure.guide-hero")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    });

    test(locale + "のGuideとStory本文へMedia Asset画像を表示する", async ({ context, page }) => {
      await useLocale(context, locale);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/discover/guides/split-the-g");
      const guideAlt = locale === "ja" ? "パブのグラス" : "A glass on a pub table";
      const guideImage = page.locator(".content-prose").getByRole("img", { name: guideAlt });
      await expect(guideImage).toBeVisible();
      await expect(guideImage).toHaveAttribute("src", `/media/${E2E_TEST_DATA.media.landscape.id}`);
      await expectNoHorizontalOverflow(page);

      await page.goto("/discover/stories/e2e-pub-story");
      const landscapeAlt = locale === "ja" ? "カウンターの写真" : "A photo of the bar";
      const portraitAlt = locale === "ja" ? "縦長の店内写真" : "A portrait photo of the pub interior";
      await expect(page.locator(".content-prose").getByRole("img", { name: landscapeAlt })).toBeVisible();
      const portrait = page.locator(".content-prose").getByRole("img", { name: portraitAlt });
      await expect(portrait).toBeVisible();
      await expect
        .poll(() => portrait.evaluate((element) => (element as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
      const naturalRatio = await portrait.evaluate((element) => {
        const image = element as HTMLImageElement;
        return image.naturalWidth / image.naturalHeight;
      });
      const bounds = await portrait.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width / bounds!.height).toBeCloseTo(naturalRatio, 1);
      await expectNoHorizontalOverflow(page);
    });
  }

  test("Media参照は登録済み画像だけへredirectする", async ({ request }) => {
    const valid = await request.get(`/media/${E2E_TEST_DATA.media.landscape.id}`, { maxRedirects: 0 });
    expect(valid.status()).toBe(307);
    expect(new URL(valid.headers().location).pathname).toBe("/media-fixtures/landscape.jpg");
    expect((await request.get("/media/not-a-valid-id", { maxRedirects: 0 })).status()).toBe(404);
    expect((await request.get("/media/550e8400-e29b-41d4-a716-446655440099", { maxRedirects: 0 })).status()).toBe(404);
  });

  for (const route of [
    "/discover/calendar",
    "/discover/quiz",
    "/discover/guides/split-the-g",
    "/discover/stories/e2e-pub-story",
  ]) {
    test(route + "がパンくずと3件の関連導線を表示する", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route);

      await expect(page.getByRole("navigation", { name: "現在位置" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: "次にExploreする" })).toBeVisible();
      await expect(page.locator(".discover-related-grid").getByRole("link")).toHaveCount(3);
      await expectNoHorizontalOverflow(page);
    });
  }
});
