import { expect, test } from "@playwright/test";
import { loginAsE2EAdmin } from "./support/page-helpers";

test("Calendar新規作成で未完成のDraftを保存する", async ({ page }) => {
  const eventId = "30000000-0000-4000-8000-000000000401";
  await loginAsE2EAdmin(page, "/admin/calendar/new");
  await expect(page.getByRole("heading", { name: "Calendar Eventを作成" })).toBeVisible();

  await page.getByRole("group", { name: "日本語" }).getByLabel("イベント名").fill("E2E Irish Calendar Draft");

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
    translations: { ja: { name: "E2E Irish Calendar Draft" }, en: { name: "" } },
    isPublicHoliday: false,
    featured: false,
  });
  await expect(page).toHaveURL(new RegExp(`/admin/calendar/${eventId}$`));
});
