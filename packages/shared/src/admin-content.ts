import type { AdminFieldErrorCode } from "./admin-api-error";
import { SUPPORTED_LOCALES, type Locale } from "./locale";

/** Editorial Contentで管理できる種類です。 */
export const CONTENT_KINDS = ["story", "guide"] as const;
/** Editorial Contentで管理できる分類です。 */
export const CONTENT_CATEGORIES = ["history", "culture", "pub-culture", "food-drink"] as const;
/** Editorial Contentの公開状態です。 */
export const CONTENT_STATUSES = ["draft", "published"] as const;
/** slugの最大文字数です。 */
export const CONTENT_SLUG_MAX_LENGTH = 100;
/** 翻訳タイトルの最大文字数です。 */
export const CONTENT_TITLE_MAX_LENGTH = 200;
/** 翻訳要約の最大文字数です。 */
export const CONTENT_SUMMARY_MAX_LENGTH = 500;
/** Markdown本文の最大文字数です。 */
export const CONTENT_BODY_MAX_LENGTH = 100_000;

/** Editorial Contentの種類です。 */
export type ContentKind = (typeof CONTENT_KINDS)[number];
/** Editorial Contentの分類です。 */
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];
/** Editorial Contentの公開状態です。 */
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** 入力途中のドラフトも表現できるContent翻訳です。 */
export type AdminContentTranslation = {
  title: string;
  summary: string;
  bodyMarkdown: string;
};

/** 管理APIが返すEditorial Content詳細です。 */
export type AdminContent = {
  id: string;
  kind: ContentKind | null;
  slug: string | null;
  category: ContentCategory | null;
  status: ContentStatus;
  publishedAt: string | null;
  translations: Record<Locale, AdminContentTranslation>;
  createdAt: string;
  updatedAt: string;
};

/** 管理一覧用の軽量なEditorial Contentです。 */
export type AdminContentListItem = Omit<AdminContent, "translations"> & {
  titleJa: string;
  titleEn: string;
};

/** 作成・更新APIが受け付ける、公開状態を含まないContent全体のスナップショットです。 */
export type AdminContentWriteInput = Pick<AdminContent, "kind" | "slug" | "category" | "translations">;
/** 公開状態変更APIの入力です。 */
export type SetAdminContentPublicationInput = { status: ContentStatus };
/** Content入力のフィールド別Validationエラーです。 */
export type AdminContentFieldErrors = Partial<Record<string, AdminFieldErrorCode>>;

/** Content作成・更新入力が契約を満たさない場合のエラーです。 */
export class AdminContentWriteValidationError extends Error {
  /**
   * 検証結果を安全なフィールド別エラーとして保持します。
   * @param {AdminContentFieldErrors} fieldErrors - APIへ公開できるエラー。
   */
  constructor(readonly fieldErrors: AdminContentFieldErrors) {
    super("Invalid admin content write input.");
    this.name = "AdminContentWriteValidationError";
  }
}

/** 公開状態変更入力が契約を満たさない場合のエラーです。 */
export class AdminContentPublicationValidationError extends Error {
  /** 未検証JSONの形式不正を表すエラーを生成します。 */
  constructor() {
    super("Invalid admin content publication input.");
    this.name = "AdminContentPublicationValidationError";
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * 未検証JSONを、入力途中の翻訳も保持できるContent入力へ変換します。
 * @param {unknown} value - Route Handlerが受け取ったJSON本文。
 * @returns {AdminContentWriteInput} 正規化済みのContent入力。
 */
export function parseAdminContentWriteInput(value: unknown): AdminContentWriteInput {
  const input = asRecord(value);
  if (!input) throw new AdminContentWriteValidationError({ input: "invalid_type" });
  const errors: AdminContentFieldErrors = {};
  validateKeys(input, ["kind", "slug", "category", "translations"], errors);

  const kind = parseNullableAllowed(input.kind, CONTENT_KINDS, "kind", errors);
  const slug = parseNullableSlug(input.slug, errors);
  const category = parseNullableAllowed(input.category, CONTENT_CATEGORIES, "category", errors);
  const translations = parseTranslations(input.translations, errors);

  if (!translations || Object.keys(errors).length > 0) {
    throw new AdminContentWriteValidationError(errors);
  }
  return { kind, slug, category, translations };
}

/**
 * 未検証JSONを公開状態変更入力へ変換します。
 * @param {unknown} value - Route Handlerが受け取ったJSON本文。
 * @returns {SetAdminContentPublicationInput} 検証済み入力。
 */
export function parseSetAdminContentPublicationInput(value: unknown): SetAdminContentPublicationInput {
  const input = asRecord(value);
  if (!input || Object.keys(input).length !== 1 || !CONTENT_STATUSES.includes(input.status as ContentStatus)) {
    throw new AdminContentPublicationValidationError();
  }
  return { status: input.status as ContentStatus };
}

/**
 * 指定値がEditorial Contentの種類かを判定します。
 * @param {string} value - 判定対象。
 * @returns {value is ContentKind} 許可済み種類の場合はtrue。
 */
export function isContentKind(value: string): value is ContentKind {
  return CONTENT_KINDS.includes(value as ContentKind);
}

/**
 * 指定値がEditorial Contentの分類かを判定します。
 * @param {string} value - 判定対象。
 * @returns {value is ContentCategory} 許可済み分類の場合はtrue。
 */
export function isContentCategory(value: string): value is ContentCategory {
  return CONTENT_CATEGORIES.includes(value as ContentCategory);
}
/**
 * 指定値が管理Editorial ContentのUUIDかを判定します。
 * @param {string} value - 判定対象。
 * @returns {boolean} UUID形式の場合はtrue。
 */
export function isAdminContentId(value: string) {
  return UUID_PATTERN.test(value);
}

function parseTranslations(value: unknown, errors: AdminContentFieldErrors) {
  const translations = asRecord(value);
  if (!translations) {
    errors.translations = value === undefined ? "required" : "invalid_type";
    return null;
  }
  validateKeys(translations, SUPPORTED_LOCALES, errors, "translations.");
  const ja = parseTranslation(translations.ja, "ja", errors);
  const en = parseTranslation(translations.en, "en", errors);
  return ja && en ? { ja, en } : null;
}

function parseTranslation(value: unknown, locale: Locale, errors: AdminContentFieldErrors) {
  const translation = asRecord(value);
  const path = `translations.${locale}`;
  if (!translation) {
    errors[path] = value === undefined ? "required" : "invalid_type";
    return null;
  }
  validateKeys(translation, ["title", "summary", "bodyMarkdown"], errors, path + ".");
  const title = parseText(translation.title, path + ".title", CONTENT_TITLE_MAX_LENGTH, errors, true);
  const summary = parseText(translation.summary, path + ".summary", CONTENT_SUMMARY_MAX_LENGTH, errors, true);
  const bodyMarkdown = parseMarkdown(translation.bodyMarkdown, path + ".bodyMarkdown", CONTENT_BODY_MAX_LENGTH, errors);
  return title === null || summary === null || bodyMarkdown === null ? null : { title, summary, bodyMarkdown };
}

function parseNullableAllowed<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
  errors: AdminContentFieldErrors,
): T[number] | null {
  if (value === null) return null;
  if (value === undefined) {
    errors[path] = "required";
    return null;
  }
  return parseAllowed(value, allowed, path, errors);
}

function parseNullableSlug(value: unknown, errors: AdminContentFieldErrors) {
  if (value === null) return null;
  if (value === undefined) {
    errors.slug = "required";
    return null;
  }
  const slug = parseText(value, "slug", CONTENT_SLUG_MAX_LENGTH, errors);
  if (slug && !SLUG_PATTERN.test(slug)) errors.slug = "invalid_format";
  return slug;
}

function parseAllowed<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
  errors: AdminContentFieldErrors,
): T[number] | null {
  if (typeof value !== "string") {
    errors[path] = value === undefined ? "required" : "invalid_type";
    return null;
  }
  if (!allowed.includes(value)) {
    errors[path] = "invalid_format";
    return null;
  }
  return value as T[number];
}

function parseText(
  value: unknown,
  path: string,
  maxLength: number,
  errors: AdminContentFieldErrors,
  allowEmpty = false,
) {
  if (typeof value !== "string") {
    errors[path] = value === undefined ? "required" : "invalid_type";
    return null;
  }
  const normalized = value.trim();
  if (!allowEmpty && !normalized) errors[path] = "required";
  else if (normalized.length > maxLength) errors[path] = "too_long";
  return normalized;
}

function validateKeys(
  input: Record<string, unknown>,
  allowed: readonly string[],
  errors: AdminContentFieldErrors,
  prefix = "",
) {
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) errors[prefix + key] = "immutable";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseMarkdown(value: unknown, path: string, maxLength: number, errors: AdminContentFieldErrors) {
  if (typeof value !== "string") {
    errors[path] = value === undefined ? "required" : "invalid_type";
    return null;
  }
  if (value.length > maxLength) errors[path] = "too_long";
  return value;
}
