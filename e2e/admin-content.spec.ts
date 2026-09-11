import { expect, test } from "@playwright/test";
import { E2E_TEST_DATA } from "../apps/web/app/lib/e2e-test-fixtures";
import { loginAsE2EAdmin } from "./support/page-helpers";

test("Content一覧から日英Preview、Draft保存、Publishを操作する", async ({ page }) => {
  await loginAsE2EAdmin(page, "/admin/content");

  await expect(page.getByRole("heading", { name: "Content管理" })).toBeVisible();
  await expect(page.getByText(E2E_TEST_DATA.content.draft.title)).toBeVisible();
  await expect(page.getByText("公開中", { exact: true })).toBeVisible();

  const draftRow = page.getByRole("row", { name: new RegExp(E2E_TEST_DATA.content.draft.title) });
  await draftRow.getByRole("link", { name: "編集" }).click();
  await expect(page.getByRole("heading", { name: "Contentを編集" })).toBeVisible();

  const japanese = page.getByRole("group", { name: "日本語" });
  await japanese.getByLabel("タイトル").fill("E2E Preview title");
  await japanese.getByLabel("本文（Markdown）").fill("## E2E Preview body");
  await page.getByRole("button", { name: "Previewを開く" }).click();
  const preview = page.locator("#admin-content-preview");
  await expect(preview.getByRole("heading", { name: "E2E Preview title" })).toBeVisible();
  await expect(preview.getByRole("heading", { name: "E2E Preview body" })).toBeVisible();
  await expect(preview.getByRole("heading", { name: "E2E Draft Guide" })).toBeVisible();
  await expect(page.getByRole("button", { name: "公開する" })).toBeDisabled();

  const updated = {
    id: E2E_TEST_DATA.content.draft.id,
    kind: "guide",
    slug: "e2e-draft-guide",
    category: "pub-culture",
    status: "draft",
    publishedAt: null,
    translations: {
      ja: {
        title: "E2E Preview title",
        summary: "E2Eで管理画面を確認するための下書きです。",
        bodyMarkdown: "## E2E Preview body",
      },
      en: {
        title: "E2E Draft Guide",
        summary: "A draft used to verify the content admin UI.",
        bodyMarkdown: "## Draft body\n\n[Safe link](/discover)",
      },
    },
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
  };
  await page.route(`**/api/admin/content/${E2E_TEST_DATA.content.draft.id}`, async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ contentType: "application/json", json: { content: updated } });
    } else {
      await route.continue();
    }
  });
  await page.getByRole("button", { name: "下書きを保存" }).click();
  await expect(page.getByRole("status")).toContainText("下書きを保存しました。");

  page.once("dialog", (dialog) => void dialog.accept());
  await page.route(`**/api/admin/content/${E2E_TEST_DATA.content.draft.id}/publication`, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        publication: { id: E2E_TEST_DATA.content.draft.id, status: "published", unchanged: false },
      },
    });
  });
  await page.getByRole("button", { name: "公開する" }).click();
  await expect(page.getByRole("status")).toContainText("Contentを公開しました。");
  await expect(page.getByText("公開中", { exact: true })).toBeVisible();
});

test("未完成Contentを新規Draftとして保存できる", async ({ page }) => {
  await loginAsE2EAdmin(page, "/admin/content/new");
  const japanese = page.getByRole("group", { name: "日本語" });
  await japanese.getByLabel("タイトル").fill("E2E 新規下書き");

  const requestPromise = page.waitForRequest(
    (request) => request.url().endsWith("/api/admin/content") && request.method() === "POST",
  );
  await page.route("**/api/admin/content", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      json: {
        content: {
          id: E2E_TEST_DATA.content.draft.id,
          kind: null,
          slug: null,
          category: null,
          status: "draft",
          publishedAt: null,
          translations: {
            ja: { title: "E2E 新規下書き", summary: "", bodyMarkdown: "" },
            en: { title: "", summary: "", bodyMarkdown: "" },
          },
          createdAt: "2026-01-15T12:00:00.000Z",
          updatedAt: "2026-01-15T12:00:00.000Z",
        },
      },
    });
  });
  await page.getByRole("button", { name: "下書きを保存" }).click();

  const request = await requestPromise;
  expect((await request.postDataJSON()).translations.ja.title).toBe("E2E 新規下書き");
  await expect(page).toHaveURL(new RegExp(`/admin/content/${E2E_TEST_DATA.content.draft.id}$`));
});
