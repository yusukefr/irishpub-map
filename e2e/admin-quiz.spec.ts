import { expect, test } from "@playwright/test";
import { E2E_TEST_DATA } from "../apps/web/app/lib/e2e-test-fixtures";
import { loginAsE2EAdmin } from "./support/page-helpers";
test("Quiz一覧からDraft保存、Choice操作、Publishを確認する", async ({ page }) => {
  await loginAsE2EAdmin(page, "/admin/quiz");
  await expect(page.getByRole("heading", { name: "Quiz管理" })).toBeVisible();
  await expect(page.getByText("E2E 下書きQuiz")).toBeVisible();
  await page
    .getByRole("row", { name: /E2E 下書きQuiz/ })
    .getByRole("link", { name: "編集" })
    .click();
  await expect(page.getByRole("heading", { name: "Quizを編集" })).toBeVisible();
  await page.getByRole("group", { name: "日本語" }).getByLabel("問題文").fill("E2E 更新Quiz");
  await page.getByRole("group", { name: "選択肢" }).getByRole("button", { name: "選択肢を追加" }).click();
  const updated = {
    id: "e2e-draft-question",
    category: null,
    specialDate: null,
    correctChoiceId: null,
    sourceUrl: null,
    relatedContentId: null,
    imageAssetId: null,
    image: null,
    isPublished: false,
    translations: {
      ja: { question: "E2E 更新Quiz", explanation: "", sourceLabel: "", imageAlt: "", imageCaption: "" },
      en: { question: "E2E Draft Quiz", explanation: "", sourceLabel: "", imageAlt: "", imageCaption: "" },
    },
    choices: [{ id: "choice-1", sortOrder: 0, translations: { ja: "", en: "" } }],
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
  };
  await page.route("**/api/admin/quiz/e2e-draft-question", async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({ contentType: "application/json", json: { question: updated } });
    else await route.continue();
  });
  await page.getByRole("button", { name: "下書きを保存" }).click();
  await expect(page.getByRole("status")).toContainText("下書きを保存しました。");
  await expect(page.getByRole("button", { name: "公開する" })).toBeDisabled();
  expect(E2E_TEST_DATA.content.draft.id).toBeTruthy();
});

test("Quiz新規作成ではQuestion IDを入力せずServer生成UUIDへ遷移する", async ({ page }) => {
  const generatedId = "30000000-0000-4000-8000-000000000303";
  await loginAsE2EAdmin(page, "/admin/quiz/new");
  await expect(page.getByRole("heading", { name: "Quizを作成" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Question ID/ })).toHaveCount(0);
  await page.route("**/api/admin/quiz", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body).not.toHaveProperty("id");
    await route.fulfill({
      contentType: "application/json",
      status: 201,
      json: {
        question: {
          id: generatedId,
          category: null,
          specialDate: null,
          correctChoiceId: null,
          sourceUrl: null,
          relatedContentId: null,
          imageAssetId: null,
          image: null,
          isPublished: false,
          translations: {
            ja: { question: "", explanation: "", sourceLabel: "", imageAlt: "", imageCaption: "" },
            en: { question: "", explanation: "", sourceLabel: "", imageAlt: "", imageCaption: "" },
          },
          choices: [],
          createdAt: "2026-01-15T12:00:00.000Z",
          updatedAt: "2026-01-15T12:00:00.000Z",
        },
      },
    });
  });
  await page.getByRole("button", { name: "下書きを保存" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/quiz/${generatedId}$`));
});

test("Quiz Editorで画像を選択し、日英の説明を保存して解除できる", async ({ page }) => {
  await loginAsE2EAdmin(page, "/admin/quiz/e2e-draft-question");
  await page.getByRole("button", { name: "画像を選択" }).click();
  const dialog = page.getByRole("dialog", { name: "画像を選択" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: new RegExp(E2E_TEST_DATA.media.landscape.id) }).click();
  await dialog.getByRole("button", { name: "選択した画像を使う" }).click();

  const japanese = page.getByRole("group", { name: "日本語" });
  const english = page.getByRole("group", { name: "英語" });
  await japanese.getByLabel("問題画像の代替テキスト").fill("日本語の画像説明");
  await english.getByLabel("問題画像の代替テキスト").fill("English image description");
  await japanese.getByLabel("問題画像のキャプション").fill("画像の説明");

  const requestPromise = page.waitForRequest(
    (request) => request.url().endsWith("/api/admin/quiz/e2e-draft-question") && request.method() === "PUT",
  );
  await page.route("**/api/admin/quiz/e2e-draft-question", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    const body = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      json: {
        question: {
          ...body,
          id: "e2e-draft-question",
          image: E2E_TEST_DATA.media.landscape,
          isPublished: false,
          choices: [],
          createdAt: "2026-01-15T12:00:00.000Z",
          updatedAt: "2026-01-15T12:00:00.000Z",
        },
      },
    });
  });
  await page.getByRole("button", { name: "下書きを保存" }).click();
  const request = await requestPromise;
  const body = request.postDataJSON();
  expect(body.imageAssetId).toBe(E2E_TEST_DATA.media.landscape.id);
  expect(body.translations.ja.imageAlt).toBe("日本語の画像説明");
  expect(body.translations.en.imageAlt).toBe("English image description");
  expect(body.translations.ja.imageCaption).toBe("画像の説明");
  await expect(page.getByRole("status")).toContainText("下書きを保存しました。");

  await page.getByRole("button", { name: "画像を解除" }).click();
  await expect(japanese.getByLabel("問題画像の代替テキスト")).toBeDisabled();
  await expect(english.getByLabel("問題画像の代替テキスト")).toHaveValue("");
});
