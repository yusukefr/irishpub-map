import type { AdminFieldErrorCode } from "@irishpub-map/shared/admin-api-error";
import { getAdminContent } from "./admin-content-repository";
import { getQuizPublicationMissingFields } from "./quiz/publication";
import {
  getAdminQuizQuestion,
  insertAdminQuizQuestion,
  listAdminQuizQuestions,
  replaceAdminQuizQuestion,
  setAdminQuizPublication,
  type AdminQuizPublicationResult,
} from "./quiz/repository";
import {
  isQuizCategory,
  isQuizId,
  QUIZ_CHOICE_ID_MAX_LENGTH,
  QUIZ_ID_MAX_LENGTH,
  type AdminQuizChoice,
  type AdminQuizListItem,
  type AdminQuizQuestion,
  type AdminQuizWriteInput,
  type QuizSpecialDate,
} from "./quiz/types";
export { getQuizPublicationMissingFields } from "./quiz/publication";
type FieldErrors = Partial<Record<string, AdminFieldErrorCode>>;
type RecordValue = Record<string, unknown>;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
/** 管理Quiz操作でAPIへ安全に公開できる業務エラーです。 */
export class AdminQuizServiceError extends Error {
  constructor(
    readonly code: "validation" | "conflict" | "not_found" | "publication_requirements_not_met",
    readonly fieldErrors: FieldErrors = {},
    readonly missingFields: string[] = [],
  ) {
    super("Admin quiz service error: " + code);
    this.name = "AdminQuizServiceError";
  }
}
/**
 * Draftを含む管理Quiz一覧を返します。
 * @returns {Promise<readonly AdminQuizListItem[]>} Quiz一覧。
 */
export async function readAdminQuizList(): Promise<readonly AdminQuizListItem[]> {
  return listAdminQuizQuestions();
}
/**
 * 未検証入力からQuestion IDを持つDraftを作成します。
 * @param value
 * @returns {Promise<AdminQuizQuestion>} 作成されたQuiz。
 */
export async function createAdminQuiz(value: unknown): Promise<AdminQuizQuestion> {
  const parsed = await parseWriteInput(value);
  if (!parsed.id) throw new AdminQuizServiceError("validation", { id: "required" });
  try {
    await insertAdminQuizQuestion(parsed.id, parsed.input);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminQuizServiceError("conflict", { id: "invalid_format" });
    throw error;
  }
  const question = await getAdminQuizQuestion(parsed.id);
  if (!question) throw new Error("Created admin quiz could not be read.");
  return question;
}
/**
 * 指定Questionを取得します。
 * @param id
 * @returns {Promise<AdminQuizQuestion>} 指定Question。
 */
export async function readAdminQuiz(id: string): Promise<AdminQuizQuestion> {
  const question = await getAdminQuizQuestion(id);
  if (!question) throw new AdminQuizServiceError("not_found");
  return question;
}
/**
 * Question全体のSnapshotを保存し、公開状態は維持します。
 * @param id
 * @param value
 * @returns {Promise<AdminQuizQuestion>} 更新されたQuiz。
 */
export async function updateAdminQuiz(id: string, value: unknown): Promise<AdminQuizQuestion> {
  const parsed = await parseWriteInput(value, id);
  let result;
  try {
    result = await replaceAdminQuizQuestion(id, parsed.input);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminQuizServiceError("conflict", { id: "invalid_format" });
    throw error;
  }
  if (result === "not_found") throw new AdminQuizServiceError("not_found");
  if (result === "publication_blocked")
    throw new AdminQuizServiceError(
      "publication_requirements_not_met",
      {},
      getQuizPublicationMissingFields(parsed.input),
    );
  const question = await getAdminQuizQuestion(id);
  if (!question) throw new Error("Updated admin quiz could not be read.");
  return question;
}
/**
 * Questionを公開またはDraftへ変更します。
 * @param id
 * @param isPublished
 * @returns {Promise<AdminQuizPublicationResult>} 変更結果。
 */
export async function changeAdminQuizPublication(
  id: string,
  isPublished: boolean,
): Promise<AdminQuizPublicationResult> {
  if (typeof isPublished !== "boolean") throw new AdminQuizServiceError("validation");
  const current = await readAdminQuiz(id);
  if (isPublished) {
    const missingFields = getQuizPublicationMissingFields(current);
    if (missingFields.length > 0)
      throw new AdminQuizServiceError("publication_requirements_not_met", {}, missingFields);
  }
  const result = await setAdminQuizPublication(id, isPublished);
  if (!result) throw new AdminQuizServiceError("not_found");
  if (isPublished && !result.isPublished) {
    const latest = await readAdminQuiz(id);
    throw new AdminQuizServiceError("publication_requirements_not_met", {}, getQuizPublicationMissingFields(latest));
  }
  return result;
}
async function parseWriteInput(
  value: unknown,
  expectedId?: string,
): Promise<{ id: string | null; input: AdminQuizWriteInput }> {
  const source = asRecord(value);
  const fieldErrors: FieldErrors = {};
  const id =
    expectedId !== undefined && source.id === undefined
      ? expectedId
      : parseId(source.id, "id", fieldErrors, QUIZ_ID_MAX_LENGTH);
  if (expectedId !== undefined && source.id !== undefined && id !== expectedId) fieldErrors.id = "immutable";
  const input = {
    category: parseCategory(source.category, fieldErrors),
    specialDate: parseSpecialDate(source.specialDate, fieldErrors),
    correctChoiceId: parseNullableId(source.correctChoiceId, "correctChoiceId", fieldErrors, QUIZ_CHOICE_ID_MAX_LENGTH),
    sourceUrl: parseSourceUrl(source.sourceUrl, fieldErrors),
    relatedContentId: parseRelatedContentId(source.relatedContentId, fieldErrors),
    translations: parseTranslations(source.translations, fieldErrors),
    choices: parseChoices(source.choices, fieldErrors),
  } satisfies AdminQuizWriteInput;
  if (input.correctChoiceId && !input.choices.some((choice) => choice.id === input.correctChoiceId))
    fieldErrors.correctChoiceId = "invalid_format";
  if (Object.keys(fieldErrors).length > 0) throw new AdminQuizServiceError("validation", fieldErrors);
  if (input.relatedContentId) {
    const content = await getAdminContent(input.relatedContentId);
    if (!content || content.kind !== "guide")
      throw new AdminQuizServiceError("validation", { relatedContentId: "invalid_format" });
  }
  return { id: expectedId ?? id, input };
}
function parseId(value: unknown, field: string, errors: FieldErrors, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") {
    errors[field] = "required";
    return null;
  }
  if (typeof value !== "string") {
    errors[field] = "invalid_type";
    return null;
  }
  if (value !== value.trim()) errors[field] = "leading_or_trailing_space";
  else if (!isQuizId(value, maxLength)) errors[field] = "invalid_format";
  return value;
}
function parseNullableId(value: unknown, field: string, errors: FieldErrors, maxLength: number): string | null {
  return value === undefined || value === null || value === "" ? null : parseId(value, field, errors, maxLength);
}
function parseCategory(value: unknown, errors: FieldErrors) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !isQuizCategory(value)) {
    errors.category = "invalid_format";
    return null;
  }
  return value;
}
function parseSpecialDate(value: unknown, errors: FieldErrors): QuizSpecialDate | null {
  if (value === undefined || value === null || value === "") return null;
  const date = asRecord(value);
  if (!Number.isInteger(date.month) || !Number.isInteger(date.day)) {
    errors.specialDate = "invalid_format";
    return null;
  }
  const month = date.month as number;
  const day = date.day as number;
  const maximum = new Date(Date.UTC(2000, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > maximum) {
    errors.specialDate = "invalid_format";
    return null;
  }
  return { month, day };
}
function parseSourceUrl(value: unknown, errors: FieldErrors): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    errors.sourceUrl = "invalid_type";
    return null;
  }
  const url = value.trim();
  if (!url) return null;
  try {
    if (new URL(url).protocol !== "https:") throw new Error("Invalid scheme");
  } catch {
    errors.sourceUrl = "invalid_format";
    return null;
  }
  return url;
}
function parseRelatedContentId(value: unknown, errors: FieldErrors): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    errors.relatedContentId = "invalid_format";
    return null;
  }
  return value;
}
function parseTranslations(value: unknown, errors: FieldErrors) {
  const source = asRecord(value);
  return { ja: parseTranslation(source.ja, "ja", errors), en: parseTranslation(source.en, "en", errors) };
}
function parseTranslation(value: unknown, locale: "ja" | "en", errors: FieldErrors) {
  const source = asRecord(value);
  return {
    question: parseText(source.question, `translations.${locale}.question`, errors),
    explanation: parseText(source.explanation, `translations.${locale}.explanation`, errors),
    sourceLabel: parseText(source.sourceLabel, `translations.${locale}.sourceLabel`, errors),
  };
}
function parseChoices(value: unknown, errors: FieldErrors): AdminQuizChoice[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    errors.choices = "invalid_type";
    return [];
  }
  if (value.length > 4) errors.choices = "too_long";
  const ids = new Set<string>();
  return value.slice(0, 4).map((choiceValue, index) => {
    const source = asRecord(choiceValue);
    const id = parseId(source.id, `choices.${index}.id`, errors, QUIZ_CHOICE_ID_MAX_LENGTH) ?? "";
    if (ids.has(id)) errors[`choices.${index}.id`] = "invalid_format";
    ids.add(id);
    if ("sortOrder" in source) errors[`choices.${index}.sortOrder`] = "invalid_format";
    const translations = asRecord(source.translations);
    return {
      id,
      sortOrder: index,
      translations: {
        ja: parseText(translations.ja, `choices.${index}.translations.ja`, errors),
        en: parseText(translations.en, `choices.${index}.translations.en`, errors),
      },
    };
  });
}
function parseText(value: unknown, field: string, errors: FieldErrors): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") {
    errors[field] = "invalid_type";
    return "";
  }
  return value.trim();
}
function asRecord(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : {};
}
function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
