import type { AdminFieldErrorCode } from "./admin-api-error";
import type { PubStatus } from "./pub";

/** 管理店舗一覧で1ページに取得する最大件数です。 */
export const ADMIN_PUB_PAGE_SIZE = 50;

/** 管理店舗一覧に表示するタグ情報です。 */
export type AdminPubListTag = {
  id: string;
  key: string;
  name: string;
};

/** 未完成な下書きも表示できる管理一覧専用DTOです。 */
export type AdminPubListItem = {
  id: string;
  name: string;
  kana: string | null;
  prefecture: string | null;
  city: string | null;
  municipalityCode: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  instagramUrl: string | null;
  tags: string[];
  tagDisplayNames: Record<string, string>;
  status: PubStatus | null;
  prefectureCode: number | null;
  statusCode: number | null;
  statusDisplayName: string | null;
  tagItems: AdminPubListTag[];
  isPublished: boolean;
  updatedAt: string;
};

/** 管理店舗一覧の検索条件です。各項目はAND条件で適用されます。 */
export type AdminPubSearchCondition = {
  name?: string;
  prefectureCode?: number;
  municipalityCode?: string;
  statusKey?: PubStatus;
  tagId?: string;
  isPublished?: boolean;
  page: number;
};

/** 管理店舗一覧のページング済みレスポンスです。 */
export type AdminPubPage = {
  pubs: AdminPubListItem[];
  total: number;
  page: number;
  pageSize: number;
};

/** 管理画面で編集する店舗翻訳です。 */
export type AdminPubTranslation = {
  name: string;
  nameReading: string | null;
  address: string | null;
};

/** 未完成な下書きと日英翻訳を表現できる管理店舗詳細です。 */
export type AdminPub = {
  id: string;
  isPublished: boolean;
  prefectureCode: number | null;
  municipalityCode: string | null;
  latitude: number | null;
  longitude: number | null;
  websiteUrl: string | null;
  googleMapsUrl: string | null;
  instagramUrl: string | null;
  status: PubStatus | null;
  translations: { ja: AdminPubTranslation; en: AdminPubTranslation | null };
  tagIds: string[];
  updatedAt: string;
};

/** 作成・更新APIが受け付ける、公開状態を含まない店舗全体のスナップショットです。 */
export type AdminPubWriteInput = Omit<AdminPub, "id" | "isPublished" | "updatedAt">;
/** 新規店舗を非公開で作成する入力です。 */
export type CreateAdminPubInput = AdminPubWriteInput;
/** 公開状態を維持して既存店舗を更新する入力です。 */
export type UpdateAdminPubInput = AdminPubWriteInput;
/** 管理店舗入力のフィールド別Validationエラーです。 */
export type AdminPubFieldErrors = Partial<Record<string, AdminFieldErrorCode>>;

/** 管理店舗入力がDraft Validationまたは入力契約を満たさない場合のエラーです。 */
export class AdminPubWriteValidationError extends Error {
  /**
   * 検証済みのフィールド別エラーを保持します。
   * @param {AdminPubFieldErrors} fieldErrors - APIで安全に返せるフィールド別理由。
   */
  constructor(readonly fieldErrors: AdminPubFieldErrors) {
    super("Invalid admin pub write input.");
    this.name = "AdminPubWriteValidationError";
  }
}

/** 管理店舗の公開状態だけを変更する入力です。 */
export type SetAdminPubPublicationInput = { isPublished: boolean };

/** 管理店舗一覧のQuery Parameterが契約を満たさない場合のエラーです。 */
export class AdminPubSearchValidationError extends Error {
  /** Query Parameter由来の失敗を内部エラーと区別して生成します。 */
  constructor() {
    super("Invalid admin pub search parameters.");
    this.name = "AdminPubSearchValidationError";
  }
}

/** 公開状態変更本文が契約を満たさない場合のエラーです。 */
export class AdminPubPublicationValidationError extends Error {
  /** JSON本文由来の失敗を内部エラーと区別して生成します。 */
  constructor() {
    super("Invalid admin pub publication input.");
    this.name = "AdminPubPublicationValidationError";
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS_KEYS = new Set<PubStatus>(["open", "temporarily_closed", "closed", "unknown"]);

/**
 * URL Query Parameterを正規化し、Repositoryへ渡せる管理店舗検索条件へ変換します。
 * @param {URLSearchParams} params - ブラウザまたはRoute Handlerから受け取ったQuery Parameter。
 * @returns {AdminPubSearchCondition} 検証・正規化済みの検索条件。
 */
export function parseAdminPubSearchParams(params: URLSearchParams): AdminPubSearchCondition {
  const allowed = new Set(["name", "prefecture", "municipality", "status", "tag", "published", "page"]);
  if ([...params.keys()].some((key) => !allowed.has(key))) throw new AdminPubSearchValidationError();

  const name = optionalSingle(params, "name")?.trim();
  if (name && name.length > 100) throw new AdminPubSearchValidationError();

  const prefectureValue = optionalSingle(params, "prefecture");
  const prefectureCode = prefectureValue === undefined ? undefined : parsePrefectureCode(prefectureValue);
  const municipalityCode = optionalSingle(params, "municipality");
  if (municipalityCode !== undefined) {
    if (
      !prefectureCode ||
      !/^\d{6}$/.test(municipalityCode) ||
      Number(municipalityCode.slice(0, 2)) !== prefectureCode
    ) {
      throw new AdminPubSearchValidationError();
    }
  }

  const statusValue = optionalSingle(params, "status");
  const statusKey = statusValue === undefined ? undefined : parseStatus(statusValue);
  const tagId = optionalSingle(params, "tag");
  if (tagId !== undefined && !UUID_PATTERN.test(tagId)) throw new AdminPubSearchValidationError();

  const publishedValue = optionalSingle(params, "published");
  const isPublished = publishedValue === undefined ? undefined : parsePublished(publishedValue);
  const pageValue = optionalSingle(params, "page");
  const page = pageValue === undefined ? 1 : Number(pageValue);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) throw new AdminPubSearchValidationError();

  return {
    ...(name ? { name } : {}),
    ...(prefectureCode ? { prefectureCode } : {}),
    ...(municipalityCode ? { municipalityCode } : {}),
    ...(statusKey ? { statusKey } : {}),
    ...(tagId ? { tagId } : {}),
    ...(isPublished === undefined ? {} : { isPublished }),
    page,
  };
}

/**
 * 未検証JSONを公開状態変更入力へ変換し、余分なフィールドも拒否します。
 * @param {unknown} value - Route Handlerが受け取ったJSON本文。
 * @returns {SetAdminPubPublicationInput} 検証済み公開状態変更入力。
 */
export function parseSetAdminPubPublicationInput(value: unknown): SetAdminPubPublicationInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AdminPubPublicationValidationError();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || typeof record.isPublished !== "boolean") {
    throw new AdminPubPublicationValidationError();
  }
  return { isPublished: record.isPublished };
}

/**
 * 未検証JSONを、日本語店舗名だけを必須とする管理店舗の全体更新入力へ変換します。
 * @param {unknown} value - APIなどから受け取った未検証の入力。
 * @returns {AdminPubWriteInput} 前後空白と任意値を正規化したDraft保存可能な入力。
 */
export function parseAdminPubWriteInput(value: unknown): AdminPubWriteInput {
  const input = asRecord(value);
  const fieldErrors: AdminPubFieldErrors = {};
  if (!input) throw new AdminPubWriteValidationError({ input: "invalid_type" });

  const fields = [
    "prefectureCode",
    "municipalityCode",
    "latitude",
    "longitude",
    "websiteUrl",
    "googleMapsUrl",
    "instagramUrl",
    "status",
    "translations",
    "tagIds",
  ] as const;
  validateKeys(input, fields, fieldErrors);
  const prefectureCode = nullablePrefectureCode(input.prefectureCode, fieldErrors);
  const municipalityCode = nullableMunicipalityCode(input.municipalityCode, fieldErrors);
  const latitude = nullableCoordinate(input.latitude, "latitude", -90, 90, fieldErrors);
  const longitude = nullableCoordinate(input.longitude, "longitude", -180, 180, fieldErrors);
  const websiteUrl = nullableUrl(input.websiteUrl, "websiteUrl", fieldErrors);
  const googleMapsUrl = nullableUrl(input.googleMapsUrl, "googleMapsUrl", fieldErrors);
  const instagramUrl = nullableUrl(input.instagramUrl, "instagramUrl", fieldErrors);
  const status = nullableStatus(input.status, fieldErrors);
  const translations = parseTranslations(input.translations, fieldErrors);
  const tagIds = parseTagIds(input.tagIds, fieldErrors);

  if (Object.keys(fieldErrors).length > 0 || !translations || !tagIds) {
    throw new AdminPubWriteValidationError(fieldErrors);
  }
  return {
    prefectureCode,
    municipalityCode,
    latitude,
    longitude,
    websiteUrl,
    googleMapsUrl,
    instagramUrl,
    status,
    translations,
    tagIds,
  };
}

function parseTranslations(value: unknown, fieldErrors: AdminPubFieldErrors) {
  const translations = asRecord(value);
  if (!translations) {
    fieldErrors.translations = value === undefined ? "required" : "invalid_type";
    return null;
  }
  validateKeys(translations, ["ja", "en"], fieldErrors, "translations.");
  const ja = parseTranslation(translations.ja, "translations.ja", false, fieldErrors);
  const en = translations.en === null ? null : parseTranslation(translations.en, "translations.en", true, fieldErrors);
  return ja && (en || translations.en === null) ? { ja, en } : null;
}

function parseTranslation(
  value: unknown,
  path: "translations.ja" | "translations.en",
  requireAddress: boolean,
  fieldErrors: AdminPubFieldErrors,
): AdminPubTranslation | null {
  const translation = asRecord(value);
  if (!translation) {
    fieldErrors[path] = value === undefined ? "required" : "invalid_type";
    return null;
  }
  validateKeys(translation, ["name", "nameReading", "address"], fieldErrors, `${path}.`);
  const name = normalizedText(translation.name, `${path}.name`, true, fieldErrors);
  const nameReading = normalizedText(translation.nameReading, `${path}.nameReading`, false, fieldErrors);
  const address = normalizedText(translation.address, `${path}.address`, requireAddress, fieldErrors);
  return name ? { name, nameReading, address } : null;
}

function parseTagIds(value: unknown, fieldErrors: AdminPubFieldErrors) {
  if (!Array.isArray(value)) {
    fieldErrors.tagIds = value === undefined ? "required" : "invalid_type";
    return null;
  }
  if (!value.every((id) => typeof id === "string" && UUID_PATTERN.test(id)) || new Set(value).size !== value.length) {
    fieldErrors.tagIds = "invalid_format";
    return null;
  }
  return [...value];
}

function nullablePrefectureCode(value: unknown, fieldErrors: AdminPubFieldErrors) {
  if (value === null) return null;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 47) {
    fieldErrors.prefectureCode = value === undefined ? "required" : "invalid_format";
    return null;
  }
  return value as number;
}

function nullableMunicipalityCode(value: unknown, fieldErrors: AdminPubFieldErrors) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{6}$/.test(value)) {
    fieldErrors.municipalityCode = value === undefined ? "required" : "invalid_format";
    return null;
  }
  return value;
}

function nullableCoordinate(
  value: unknown,
  field: "latitude" | "longitude",
  minimum: number,
  maximum: number,
  fieldErrors: AdminPubFieldErrors,
) {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    fieldErrors[field] = value === undefined ? "required" : "invalid_format";
    return null;
  }
  return value;
}

function nullableUrl(value: unknown, field: string, fieldErrors: AdminPubFieldErrors) {
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    fieldErrors[field] = value === undefined ? "required" : "invalid_type";
    return null;
  }
  const normalized = value.trim();
  try {
    const url = new URL(normalized);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) throw new Error();
    return normalized;
  } catch {
    fieldErrors[field] = "invalid_format";
    return null;
  }
}

function nullableStatus(value: unknown, fieldErrors: AdminPubFieldErrors): PubStatus | null {
  if (value === null) return null;
  if (!STATUS_KEYS.has(value as PubStatus)) {
    fieldErrors.status = value === undefined ? "required" : "invalid_format";
    return null;
  }
  return value as PubStatus;
}

function normalizedText(value: unknown, field: string, required: boolean, fieldErrors: AdminPubFieldErrors) {
  if (value === undefined || value === null || value === "") {
    if (required) fieldErrors[field] = "required";
    return null;
  }
  if (typeof value !== "string") {
    fieldErrors[field] = "invalid_type";
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    if (required) fieldErrors[field] = "required";
    return null;
  }
  return normalized;
}

function validateKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  fieldErrors: AdminPubFieldErrors,
  prefix = "",
) {
  const allowed = new Set(expected);
  for (const field of expected) if (!(field in value)) fieldErrors[`${prefix}${field}`] = "required";
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) {
      fieldErrors[`${prefix}${field}`] = field === "isPublished" ? "immutable" : "invalid_format";
    }
  }
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function optionalSingle(params: URLSearchParams, key: string) {
  const values = params.getAll(key);
  if (values.length > 1) throw new AdminPubSearchValidationError();
  const value = values[0];
  return value === undefined || value === "" ? undefined : value;
}

function parsePrefectureCode(value: string) {
  if (!/^(?:[1-9]|[1-3][0-9]|4[0-7])$/.test(value)) throw new AdminPubSearchValidationError();
  return Number(value);
}

function parseStatus(value: string) {
  if (!STATUS_KEYS.has(value as PubStatus)) throw new AdminPubSearchValidationError();
  return value as PubStatus;
}

function parsePublished(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new AdminPubSearchValidationError();
}
