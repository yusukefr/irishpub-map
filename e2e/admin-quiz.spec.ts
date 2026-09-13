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
    isPublished: false,
    translations: {
      ja: { question: "E2E 更新Quiz", explanation: "", sourceLabel: "" },
      en: { question: "E2E Draft Quiz", explanation: "", sourceLabel: "" },
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
