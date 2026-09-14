import { expect, test } from "@playwright/test";

test("今日のクイズを正解として採点し、回答前に回答情報を送らない", async ({ page }) => {
  await page.goto("/discover/quiz");

  await expect(page.getByRole("heading", { level: 1, name: "Today's Ireland Quiz" })).toBeVisible();
  await expect(page.getByText("E2E Draft Quiz")).not.toBeVisible();
  await expect(page.getByText("An explanation for E2E.")).not.toBeVisible();
  await expect(page.getByText("E2E Source")).not.toBeVisible();

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

  await page.reload();
  await expect(page.getByRole("button", { name: "回答する" })).toBeDisabled();
  for (const choice of await page.getByRole("radio").all()) await expect(choice).toBeEnabled();
});

test("英語表示で不正解を採点し、正解ChoiceとExplanationを表示する", async ({ context, page }) => {
  await context.addCookies([{ name: "irishpub-map-locale", value: "en", domain: "localhost", path: "/" }]);
  await page.goto("/discover/quiz");

  await expect(page.getByRole("heading", { level: 1, name: "Today's Ireland Quiz" })).toBeVisible();
  await expect(page.getByText("E2E Published Quiz")).toBeVisible();
  const choices = page.getByRole("radio");
  await expect(choices).toHaveCount(4);
  await choices.nth(1).check();
  await page.getByRole("button", { name: "Submit answer" }).click();

  await expect(page.getByRole("heading", { level: 3, name: "Not quite!" })).toBeVisible();
  await expect(page.getByText("Correct answer: Choice 1")).toBeVisible();
  await expect(page.getByRole("heading", { level: 4, name: "Explanation" })).toBeVisible();
  await expect(page.getByText("An explanation for E2E.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Answered" })).toBeDisabled();
});
