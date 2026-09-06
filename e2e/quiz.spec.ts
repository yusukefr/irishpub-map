import { expect, test } from "@playwright/test";

test("今日のクイズをServer Actionで採点し、回答後の情報を固定表示する", async ({ page }) => {
  await page.goto("/discover/quiz");

  const choices = page.getByRole("radio");
  await expect(choices).toHaveCount(4);
  await choices.first().check();
  await page.getByRole("button", { name: "回答する" }).click();

  await expect(page.getByRole("heading", { level: 3, name: /^(正解！ 🎉|残念！)$/u })).toBeVisible();
  await expect(page.getByRole("heading", { level: 4, name: "解説" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^情報源:/u })).toBeVisible();
  await expect(page.getByText(/^正解:/u)).toBeVisible();
  await expect(page.getByRole("button", { name: "回答済み" })).toBeDisabled();
  for (const choice of await choices.all()) await expect(choice).toBeDisabled();
});
