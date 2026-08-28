/** タグ内部キーとして受け付ける最大文字数です。 */
export const ADMIN_TAG_KEY_MAX_LENGTH = 64;
/** タグ表示名として受け付ける最大文字数です。 */
export const ADMIN_TAG_NAME_MAX_LENGTH = 100;

/** 管理画面で日英翻訳と使用店舗数を同時に扱うタグです。 */
export type AdminTag = {
  id: string;
  key: string;
  nameJa: string;
  nameEn: string | null;
  pubCount: number;
};

/** タグ登録時にサーバー側で検証済みとなる入力です。 */
export type CreateAdminTagInput = {
  key: string;
  nameJa: string;
  nameEn: string | null;
};

/** タグ更新時にサーバー側で検証済みとなる表示名入力です。 */
export type UpdateAdminTagInput = Omit<CreateAdminTagInput, "key">;

/** 管理タグ入力のフィールド別Validationエラーです。 */
export type AdminTagFieldErrors = Partial<Record<keyof CreateAdminTagInput, string>>;

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
 * 外部入力を、新規タグとして保存可能な内部キーと日英表示名へ変換します。
 * @param {unknown} value - APIなどから受け取った未検証の入力。
 * @returns {CreateAdminTagInput} 前後空白を処理した検証済み入力。
 */
export function parseCreateAdminTagInput(value: unknown): CreateAdminTagInput {
  const input = asRecord(value);
  const fieldErrors: AdminTagFieldErrors = {};
  const key = validateKey(input?.key, fieldErrors);
  const nameJa = validateRequiredName(input?.nameJa, "nameJa", fieldErrors);
  const nameEn = validateOptionalName(input?.nameEn, fieldErrors);
  if (Object.keys(fieldErrors).length > 0) throw new AdminTagValidationError(fieldErrors);
  return { key: key!, nameJa: nameJa!, nameEn };
}

/**
 * 外部入力を、既存タグの表示名更新として保存可能な値へ変換します。内部キーの変更は拒否します。
 * @param {unknown} value - APIなどから受け取った未検証の入力。
 * @returns {UpdateAdminTagInput} 前後空白を処理した検証済み入力。
 */
export function parseUpdateAdminTagInput(value: unknown): UpdateAdminTagInput {
  const input = asRecord(value);
  const fieldErrors: AdminTagFieldErrors = {};
  if (input && "key" in input) fieldErrors.key = "keyは作成後に変更できません。";
  const nameJa = validateRequiredName(input?.nameJa, "nameJa", fieldErrors);
  const nameEn = validateOptionalName(input?.nameEn, fieldErrors);
  if (Object.keys(fieldErrors).length > 0) throw new AdminTagValidationError(fieldErrors);
  return { nameJa: nameJa!, nameEn };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function validateKey(value: unknown, fieldErrors: AdminTagFieldErrors) {
  if (typeof value !== "string" || !value) {
    fieldErrors.key = "keyは必須です。";
    return null;
  }
  if (value !== value.trim()) fieldErrors.key = "keyの前後に空白は使用できません。";
  else if (value.length > ADMIN_TAG_KEY_MAX_LENGTH) {
    fieldErrors.key = `keyは${ADMIN_TAG_KEY_MAX_LENGTH}文字以内で入力してください。`;
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    fieldErrors.key = "keyは小文字英数字と単語間のハイフンだけを使用してください。";
  }
  return value;
}

function validateRequiredName(value: unknown, field: "nameJa", fieldErrors: AdminTagFieldErrors) {
  if (typeof value !== "string" || !value.trim()) {
    fieldErrors[field] = "日本語表示名は必須です。";
    return null;
  }
  const normalized = value.trim();
  if (normalized.length > ADMIN_TAG_NAME_MAX_LENGTH) {
    fieldErrors[field] = `日本語表示名は${ADMIN_TAG_NAME_MAX_LENGTH}文字以内で入力してください。`;
  }
  return normalized;
}

function validateOptionalName(value: unknown, fieldErrors: AdminTagFieldErrors) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    fieldErrors.nameEn = "英語表示名を文字列で入力してください。";
    return null;
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > ADMIN_TAG_NAME_MAX_LENGTH) {
    fieldErrors.nameEn = `英語表示名は${ADMIN_TAG_NAME_MAX_LENGTH}文字以内で入力してください。`;
  }
  return normalized;
}
