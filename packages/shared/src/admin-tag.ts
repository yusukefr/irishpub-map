import type { AdminFieldErrorCode } from "./admin-api-error";
import { REQUIRED_TRANSLATION_LOCALE, SUPPORTED_LOCALES, type Locale } from "./locale";

/** タグ内部キーとして受け付ける最大文字数です。 */
export const ADMIN_TAG_KEY_MAX_LENGTH = 64;
/** タグ表示名として受け付ける最大文字数です。 */
export const ADMIN_TAG_NAME_MAX_LENGTH = 100;

/** 管理画面でサポートlocaleの翻訳と使用店舗数を同時に扱うタグです。 */
export type AdminTag = {
  id: string;
  key: string;
  translations: AdminTagTranslations;
  pubCount: number;
};

/** 必須localeを含むタグ翻訳です。その他のサポートlocaleは任意です。 */
export type AdminTagTranslations = {
  [REQUIRED_TRANSLATION_LOCALE]: string;
} & Partial<Record<Exclude<Locale, typeof REQUIRED_TRANSLATION_LOCALE>, string>>;

/** タグ登録・更新時にサーバー側で検証済みとなる入力です。 */
export type CreateAdminTagInput = {
  key: string;
  translations: AdminTagTranslations;
};

/** タグ更新時にサーバー側で検証済みとなる翻訳入力です。 */
export type UpdateAdminTagInput = Omit<CreateAdminTagInput, "key">;

/** 管理タグ入力のフィールド名です。 */
export type AdminTagField = "key" | `translations.${Locale}`;
/** 管理タグ入力のフィールド別Validationエラーです。 */
export type AdminTagFieldErrors = Partial<Record<AdminTagField, AdminFieldErrorCode>>;

/** 管理タグ入力が契約を満たさない場合にフィールド別エラーを保持します。 */
export class AdminTagValidationError extends Error {
  /**
   * フィールド別Validationエラーを保持して生成します。
   * @param {AdminTagFieldErrors} fieldErrors - 利用者へ返せるフィールド別エラー。
   */
  constructor(readonly fieldErrors: AdminTagFieldErrors) {
    super("Invalid admin tag input.");
    this.name = "AdminTagValidationError";
  }
}

/**
 * 外部入力を、新規タグとして保存可能な内部キーとlocale別翻訳へ変換します。
 * @param {unknown} value - APIなどから受け取った未検証の入力。
 * @returns {CreateAdminTagInput} 前後空白を処理した検証済み入力。
 */
export function parseCreateAdminTagInput(value: unknown): CreateAdminTagInput {
  const input = asRecord(value);
  const fieldErrors: AdminTagFieldErrors = {};
  const key = validateKey(input?.key, fieldErrors);
  const translations = validateTranslations(input?.translations, fieldErrors);
  if (Object.keys(fieldErrors).length > 0) throw new AdminTagValidationError(fieldErrors);
  return { key: key!, translations: translations! };
}

/**
 * 外部入力を、既存タグのlocale別翻訳更新として保存可能な値へ変換します。内部キーの変更は拒否します。
 * @param {unknown} value - APIなどから受け取った未検証の入力。
 * @returns {UpdateAdminTagInput} 前後空白を処理した検証済み入力。
 */
export function parseUpdateAdminTagInput(value: unknown): UpdateAdminTagInput {
  const input = asRecord(value);
  const fieldErrors: AdminTagFieldErrors = {};
  if (input && "key" in input) fieldErrors.key = "immutable";
  const translations = validateTranslations(input?.translations, fieldErrors);
  if (Object.keys(fieldErrors).length > 0) throw new AdminTagValidationError(fieldErrors);
  return { translations: translations! };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function validateKey(value: unknown, fieldErrors: AdminTagFieldErrors) {
  if (typeof value !== "string" || !value) {
    fieldErrors.key = "required";
    return null;
  }
  if (value !== value.trim()) fieldErrors.key = "leading_or_trailing_space";
  else if (value.length > ADMIN_TAG_KEY_MAX_LENGTH) {
    fieldErrors.key = "too_long";
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    fieldErrors.key = "invalid_format";
  }
  return value;
}

function validateTranslations(value: unknown, fieldErrors: AdminTagFieldErrors): AdminTagTranslations | null {
  const input = asRecord(value);
  const translations: Partial<Record<Locale, string>> = {};
  for (const locale of SUPPORTED_LOCALES) {
    const field = `translations.${locale}` as AdminTagField;
    const name =
      locale === REQUIRED_TRANSLATION_LOCALE
        ? validateRequiredName(input?.[locale], field, fieldErrors)
        : validateOptionalName(input?.[locale], field, fieldErrors);
    if (name !== null) translations[locale] = name;
  }
  return translations[REQUIRED_TRANSLATION_LOCALE] ? (translations as AdminTagTranslations) : null;
}

function validateRequiredName(value: unknown, field: AdminTagField, fieldErrors: AdminTagFieldErrors) {
  if (typeof value !== "string" || !value.trim()) {
    fieldErrors[field] = "required";
    return null;
  }
  const normalized = value.trim();
  if (normalized.length > ADMIN_TAG_NAME_MAX_LENGTH) {
    fieldErrors[field] = "too_long";
  }
  return normalized;
}

function validateOptionalName(value: unknown, field: AdminTagField, fieldErrors: AdminTagFieldErrors) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    fieldErrors[field] = "invalid_type";
    return null;
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > ADMIN_TAG_NAME_MAX_LENGTH) {
    fieldErrors[field] = "too_long";
  }
  return normalized;
}
