import type { AdminQuizQuestion, AdminQuizWriteInput } from "./types";

/**
 * 保存済みQuizの公開不足フィールドを返します。
 * @param input - 検証対象のQuiz。
 * @returns {string[]} 公開に不足するフィールド。
 */
export function getQuizPublicationMissingFields(input: AdminQuizQuestion | AdminQuizWriteInput): string[] {
  const missing: string[] = [];
  if (!input.category) missing.push("category");
  for (const locale of ["ja", "en"] as const) {
    const translation = input.translations[locale];
    if (!translation.question.trim()) missing.push(`translations.${locale}.question`);
    if (!translation.explanation.trim()) missing.push(`translations.${locale}.explanation`);
    if (!translation.sourceLabel.trim()) missing.push(`translations.${locale}.sourceLabel`);
  }
  if (!input.sourceUrl) missing.push("sourceUrl");
  if (input.choices.length !== 4) missing.push("choices");
  input.choices.forEach((choice, index) => {
    if (!choice.id.trim()) missing.push(`choices.${index}.id`);
    if (!choice.translations.ja.trim()) missing.push(`choices.${index}.translations.ja`);
    if (!choice.translations.en.trim()) missing.push(`choices.${index}.translations.en`);
  });
  if (!input.correctChoiceId || !input.choices.some((choice) => choice.id === input.correctChoiceId))
    missing.push("correctChoiceId");
  return missing;
}
