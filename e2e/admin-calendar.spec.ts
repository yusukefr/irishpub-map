import { expect, test } from "@playwright/test";
import { E2E_TEST_DATA } from "../apps/web/app/lib/e2e-test-fixtures";
import { loginAsE2EAdmin } from "./support/page-helpers";

test("Calendar新規作成で未完成のDraftを保存する", async ({ page }) => {
  const eventId = E2E_TEST_DATA.calendar.draft.id;
  await loginAsE2EAdmin(page, "/admin/calendar/new");
  await expect(page.getByRole("heading", { name: "Calendar Eventを作成" })).toBeVisible();

  await page.getByRole("group", { name: "日本語" }).getByLabel("イベント名").fill(E2E_TEST_DATA.calendar.draft.title);

  const createRequest = page.waitForRequest(
    (request) => request.url().endsWith("/api/admin/calendar") && request.method() === "POST",
  );
  await page.route("**/api/admin/calendar", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      json: {
        event: {
          ...body,
          id: eventId,
          category: null,
          dateRule: null,
          isPublished: false,
          sortOrder: 0,
          createdAt: "2026-01-15T12:00:00.000Z",
          updatedAt: "2026-01-15T12:00:00.000Z",
        },
      },
    });
  });

  await page.getByRole("button", { name: "下書きを保存" }).click();
  const request = await createRequest;
  const body = request.postDataJSON() as Record<string, unknown>;
  expect(body).not.toHaveProperty("id");
  expect(body).toMatchObject({
    translations: { ja: { name: E2E_TEST_DATA.calendar.draft.title }, en: { name: "" } },
    isPublicHoliday: false,
    featured: false,
  });
  await expect(page).toHaveURL(new RegExp(`/admin/calendar/${eventId}$`));
  await expect(page.getByRole("heading", { name: "Calendar Eventを編集" })).toBeVisible();
  await expect(page.getByRole("group", { name: "日本語" }).getByLabel("イベント名")).toHaveValue(
    E2E_TEST_DATA.calendar.draft.title,
  );
  await expect(page.getByText("下書き", { exact: true })).toBeVisible();
});

test("Calendar管理画面は日英とDesktop・Mobileで横overflowせず表示できる", async ({ page }) => {
  await loginAsE2EAdmin(page, "/admin/calendar");

  const pages = [
    { path: "/admin/calendar", name: "list" },
    { path: "/admin/calendar/new", name: "new" },
    { path: `/admin/calendar/${E2E_TEST_DATA.calendar.draft.id}`, name: "edit" },
  ];
  const viewports = [
    { width: 1440, height: 1000 },
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
    { width: 360, height: 780 },
  ];

  for (const locale of ["ja", "en"] as const) {
    await page.context().addCookies([{ name: "irishpub-map-locale", value: locale, url: "http://localhost:3100" }]);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);

      for (const route of pages) {
        await page.goto(route.path);
        await expect(page.locator("h1")).toBeVisible();
        const dimensions = await page.evaluate(() => ({
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        }));
        expect(dimensions.documentWidth, `${locale} ${route.name} at ${viewport.width}px`).toBeLessThanOrEqual(
          dimensions.viewportWidth,
        );

        if (viewport.width === 1280 || viewport.width === 390) {
          await expect(page).toHaveScreenshot(`calendar-${locale}-${route.name}-${viewport.width}.png`, {
            fullPage: true,
          });
        }
      }
    }
  }
});
