import {
  isAdminApiErrorCode,
  isAdminFieldErrorCode,
  type AdminApiErrorCode,
  type AdminFieldErrorCode,
} from "@irishpub-map/shared/admin-api-error";
import { ADMIN_STATUS_NAME_MAX_LENGTH, type AdminStatusFieldErrors } from "@irishpub-map/shared/admin-status";
import {
  ADMIN_TAG_KEY_MAX_LENGTH,
  ADMIN_TAG_NAME_MAX_LENGTH,
  type AdminTagFieldErrors,
} from "@irishpub-map/shared/admin-tag";
import { formatMessage, getTranslation, type Locale, type Translation } from "./i18n";

/** Clientが成功レスポンスと同時に受け取る可能性がある管理APIエラー部分です。 */
export type AdminApiClientError = {
  errorCode?: unknown;
  fieldErrors?: unknown;
};

/**
 * 未検証の管理APIレスポンスから、現在のlocaleに対応する表示文言を解決します。
 * @param {Locale} locale - 現在の画面表示言語。
 * @param {unknown} value - APIから受け取った未検証JSON。
 * @returns {string} 既知コードの翻訳、または内部エラーの安全なフォールバック。
 */
export function getAdminApiErrorMessage(locale: Locale, value: unknown) {
  const errorCode = getErrorCode(value);
  return getTranslation(locale).admin.errors[errorCode];
}

/**
 * タグAPIのフィールド別Validationを優先し、現在のlocaleの文言へ変換します。
 * @param {Locale} locale - 現在の画面表示言語。
 * @param {unknown} value - APIから受け取った未検証JSON。
 * @returns {string} フィールド別文言、APIエラー文言、または安全な一般エラー。
 */
export function getAdminTagApiErrorMessage(locale: Locale, value: unknown) {
  const fieldError = getFirstTagFieldError(value);
  if (!fieldError) return getAdminApiErrorMessage(locale, value);
  return translateTagFieldError(getTranslation(locale), fieldError[0], fieldError[1]);
}

/**
 * 営業ステータスAPIのフィールド別Validationを優先し、現在のlocaleの文言へ変換します。
 * @param {Locale} locale - 現在の画面表示言語。
 * @param {unknown} value - APIから受け取った未検証JSON。
 * @returns {string} フィールド別文言、APIエラー文言、または安全な一般エラー。
 */
export function getAdminStatusApiErrorMessage(locale: Locale, value: unknown) {
  const fieldError = getFirstFieldError<keyof AdminStatusFieldErrors>(value, ["nameJa", "nameEn"]);
  if (!fieldError) return getAdminApiErrorMessage(locale, value);
  const messages = getTranslation(locale).admin.statusFieldErrors;
  if (fieldError[0] === "nameJa") {
    if (fieldError[1] === "required") return messages.nameJa.required;
    if (fieldError[1] === "too_long") {
      return formatMessage(messages.nameJa.too_long, { max: ADMIN_STATUS_NAME_MAX_LENGTH });
    }
  }
  if (fieldError[0] === "nameEn") {
    if (fieldError[1] === "invalid_type") return messages.nameEn.invalid_type;
    if (fieldError[1] === "too_long") {
      return formatMessage(messages.nameEn.too_long, { max: ADMIN_STATUS_NAME_MAX_LENGTH });
    }
  }
  return getTranslation(locale).admin.errors.validation_error;
}

function getErrorCode(value: unknown): AdminApiErrorCode {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "internal_error";
  const { errorCode } = value as { errorCode?: unknown };
  return isAdminApiErrorCode(errorCode) ? errorCode : "internal_error";
}

function getFirstTagFieldError(value: unknown): [keyof AdminTagFieldErrors, AdminFieldErrorCode] | null {
  return getFirstFieldError(value, ["key", "nameJa", "nameEn"]);
}

function getFirstFieldError<Field extends string>(
  value: unknown,
  fields: readonly Field[],
): [Field, AdminFieldErrorCode] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { fieldErrors } = value as { fieldErrors?: unknown };
  if (!fieldErrors || typeof fieldErrors !== "object" || Array.isArray(fieldErrors)) return null;
  for (const field of fields) {
    const code = (fieldErrors as Record<string, unknown>)[field];
    if (isAdminFieldErrorCode(code)) return [field, code];
  }
  return null;
}

function translateTagFieldError(translation: Translation, field: keyof AdminTagFieldErrors, code: AdminFieldErrorCode) {
  const messages = translation.admin.tagFieldErrors;
  if (field === "key") {
    if (code === "required") return messages.key.required;
    if (code === "too_long") return formatMessage(messages.key.too_long, { max: ADMIN_TAG_KEY_MAX_LENGTH });
    if (code === "invalid_format") return messages.key.invalid_format;
    if (code === "leading_or_trailing_space") return messages.key.leading_or_trailing_space;
    if (code === "immutable") return messages.key.immutable;
  }
  if (field === "nameJa") {
    if (code === "required") return messages.nameJa.required;
    if (code === "too_long") return formatMessage(messages.nameJa.too_long, { max: ADMIN_TAG_NAME_MAX_LENGTH });
  }
  if (field === "nameEn") {
    if (code === "invalid_type") return messages.nameEn.invalid_type;
    if (code === "too_long") return formatMessage(messages.nameEn.too_long, { max: ADMIN_TAG_NAME_MAX_LENGTH });
  }
  return translation.admin.errors.validation_error;
}
