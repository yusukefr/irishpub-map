import { randomUUID } from "node:crypto";
import {
  AdminContentWriteValidationError,
  parseAdminContentWriteInput,
  type AdminContent,
  type AdminContentFieldErrors,
  type AdminContentListItem,
  type AdminContentWriteInput,
  type ContentStatus,
} from "@irishpub-map/shared/admin-content";
import {
  getAdminContent,
  insertAdminContent,
  listAdminContent,
  replaceAdminContent,
  setAdminContentPublication,
} from "./admin-content-repository";
import { invalidateContentCache } from "./content/cache";
import { getContentPublicationMissingFields, hasOnlySafeMarkdownUrls } from "./content/validation";

/** 管理Editorial Content操作でAPIへ安全に公開できる業務エラーです。 */
export class AdminContentServiceError extends Error {
  /**
   * Content操作の業務エラーを生成します。
   * @param {"validation" | "conflict" | "not_found" | "publication_requirements_not_met"} code - エラー種別。
   * @param {AdminContentFieldErrors} fieldErrors - フィールド別エラー。
   * @param {string[]} missingFields - 公開条件を満たさないフィールド。
   */
  constructor(
    readonly code: "validation" | "conflict" | "not_found" | "publication_requirements_not_met",
    readonly fieldErrors: AdminContentFieldErrors = {},
    readonly missingFields: string[] = [],
  ) {
    super("Admin content service error: " + code);
    this.name = "AdminContentServiceError";
  }
}

/**
 * Draftを含む管理Editorial Content一覧を返します。
 * @returns {Promise<AdminContentListItem[]>} 更新日時降順の一覧。
 */
export async function readAdminContentList(): Promise<AdminContentListItem[]> {
  return listAdminContent();
}

/**
 * 未検証入力からEditorial ContentのDraftを作成します。
 * @param {unknown} value - Route Handlerが受け取ったJSON。
 * @returns {Promise<AdminContent>} 作成後の詳細。
 */
export async function createAdminContent(value: unknown): Promise<AdminContent> {
  const input = parseWriteInput(value);
  const id = randomUUID();
  try {
    await insertAdminContent(id, input);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminContentServiceError("conflict", { slug: "invalid_format" });
    throw error;
  }
  const created = await getAdminContent(id);
  if (!created) throw new Error("Created admin content could not be read.");
  return created;
}

/**
 * 指定IDの管理Editorial Content詳細を返します。
 * @param {string} id - Content UUID。
 * @returns {Promise<AdminContent>} 対象がなければ業務エラー。
 */
export async function readAdminContent(id: string): Promise<AdminContent> {
  const content = await getAdminContent(id);
  if (!content) throw new AdminContentServiceError("not_found");
  return content;
}

/**
 * 公開状態を維持してEditorial Content全体を更新します。
 * @param {string} id - Content UUID。
 * @param {unknown} value - 未検証JSON。
 * @returns {Promise<AdminContent>} 更新後詳細。
 */
export async function updateAdminContent(id: string, value: unknown): Promise<AdminContent> {
  const input = parseWriteInput(value);
  const publishReady = getContentPublicationMissingFields(input).length === 0;
  let result;
  try {
    result = await replaceAdminContent(id, input, publishReady);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminContentServiceError("conflict", { slug: "invalid_format" });
    throw error;
  }
  if (result.code === "not_found") throw new AdminContentServiceError("not_found");
  if (result.code === "publication_blocked") {
    throw new AdminContentServiceError(
      "publication_requirements_not_met",
      {},
      getContentPublicationMissingFields(input),
    );
  }

  const updated = await getAdminContent(id);
  if (!updated) throw new Error("Updated admin content could not be read.");
  if (result.previousStatus === "published") {
    if (result.previous) invalidateContentCache(result.previous.kind, result.previous.slug);
    if (updated.kind && updated.slug) invalidateContentCache(updated.kind, updated.slug);
  }
  return updated;
}

/**
 * Editorial Contentを公開またはDraftへ変更します。
 * @param {string} id - Content UUID。
 * @param {ContentStatus} status - 変更後状態。
 * @returns {Promise<{ id: string; status: ContentStatus; unchanged: boolean; publishedAt: string | null }>} 公開状態変更結果。
 */
export async function changeAdminContentPublication(id: string, status: ContentStatus) {
  const current = await readAdminContent(id);
  if (status === "published") {
    const missingFields = getPublicationMissingFields(current);
    if (missingFields.length > 0) {
      throw new AdminContentServiceError("publication_requirements_not_met", {}, missingFields);
    }
  }

  const result = await setAdminContentPublication(id, status);
  if (!result) throw new AdminContentServiceError("not_found");
  if (result.status !== status) {
    const latest = await readAdminContent(id);
    throw new AdminContentServiceError("publication_requirements_not_met", {}, getPublicationMissingFields(latest));
  }
  if (!result.unchanged && result.identity) invalidateContentCache(result.identity.kind, result.identity.slug);
  return {
    id: result.id,
    status: result.status,
    unchanged: result.unchanged,
    publishedAt: result.publishedAt,
  };
}

/**
 * 保存済みContentの公開不足フィールドを返します。
 * @param {AdminContent} content - 管理Content詳細。
 * @returns {string[]} 公開に不足または不正なフィールド。
 */
export function getPublicationMissingFields(content: AdminContent): string[] {
  const input: AdminContentWriteInput = {
    kind: content.kind,
    slug: content.slug,
    category: content.category,
    translations: content.translations,
  };
  return [
    ...getContentPublicationMissingFields(input),
    ...getUnsafeMarkdownFields(input).filter((field) => !getContentPublicationMissingFields(input).includes(field)),
  ];
}

function parseWriteInput(value: unknown) {
  let input: AdminContentWriteInput;
  try {
    input = parseAdminContentWriteInput(value);
  } catch (error) {
    if (error instanceof AdminContentWriteValidationError) {
      throw new AdminContentServiceError("validation", error.fieldErrors);
    }
    throw error;
  }
  const unsafeFields = getUnsafeMarkdownFields(input);
  if (unsafeFields.length > 0) {
    throw new AdminContentServiceError(
      "validation",
      Object.fromEntries(unsafeFields.map((field) => [field, "invalid_format"])),
    );
  }
  return input;
}

function getUnsafeMarkdownFields(input: AdminContentWriteInput) {
  return (["ja", "en"] as const)
    .filter((locale) => !hasOnlySafeMarkdownUrls(input.translations[locale].bodyMarkdown))
    .map((locale) => `translations.${locale}.bodyMarkdown`);
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
