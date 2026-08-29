import type { Pub, PubStatus } from "./pub";

/** 管理店舗一覧で1ページに取得する最大件数です。 */
export const ADMIN_PUB_PAGE_SIZE = 50;

/** 管理店舗一覧に表示するタグ情報です。 */
export type AdminPubListTag = {
  id: string;
  key: string;
  name: string;
};

/** 編集に必要な現行店舗情報と、管理一覧専用の識別子・状態をまとめたDTOです。 */
export type AdminPubListItem = Pub & {
  prefectureCode: number;
  statusCode: number;
  statusDisplayName: string;
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
