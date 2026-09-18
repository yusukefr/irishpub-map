import type { AdminFieldErrorCode } from "@irishpub-map/shared/admin-api-error";
import { isCalendarEventId, parseCalendarDateRuleDefinition } from "./calendar/validation";
import { getCalendarPublicationMissingFields } from "./calendar/publication";
import {
  deleteCalendarEvent,
  getAdminCalendarEvent,
  insertCalendarEvent,
  listAdminCalendarEvents,
  setCalendarEventPublication,
  updateCalendarEvent,
  type CalendarEventDeleteResult,
} from "./calendar/repository";
import {
  type AdminCalendarEvent,
  type AdminCalendarListItem,
  type AdminCalendarWriteInput,
  type CalendarCategory,
  type CalendarDateRuleDefinition,
} from "./calendar/types";

type FieldErrors = Partial<Record<string, AdminFieldErrorCode>>;
type RecordValue = Record<string, unknown>;
const CATEGORIES = [
  "public_holiday",
  "culture",
  "tradition",
  "language",
  "literature",
  "history",
  "religion",
] as const satisfies readonly CalendarCategory[];

/** Calendar管理操作でAPIへ安全に公開できる業務エラーです。 */
export class AdminCalendarServiceError extends Error {
  constructor(
    readonly code: "validation" | "conflict" | "not_found" | "publication_requirements_not_met",
    readonly fieldErrors: FieldErrors = {},
    readonly missingFields: string[] = [],
  ) {
    super("Admin calendar service error: " + code);
    this.name = "AdminCalendarServiceError";
  }
}

/**
 * DraftとPublishedを含む管理Calendar一覧を返します。
 * @returns 管理Calendar一覧。
 */
export function readAdminCalendarList(): Promise<readonly AdminCalendarListItem[]> {
  return listAdminCalendarEvents();
}

/**
 * 未検証入力からCalendar Eventを作成します。
 * @param value
 * @returns 作成されたCalendar Event。
 */
export async function createAdminCalendarEvent(value: unknown): Promise<AdminCalendarEvent> {
  const parsed = parseWriteInput(value);
  if (!parsed.id) throw new AdminCalendarServiceError("validation", { id: "required" });
  try {
    await insertCalendarEvent(parsed.id, parsed.input);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminCalendarServiceError("conflict", { id: "invalid_format" });
    throw error;
  }
  const event = await getAdminCalendarEvent(parsed.id);
  if (!event) throw new Error("Created admin calendar event could not be read.");
  return event;
}

/**
 * 指定Calendar Eventを取得します。
 * @param id
 * @returns 指定されたCalendar Event。
 */
export async function readAdminCalendarEvent(id: string): Promise<AdminCalendarEvent> {
  const event = await getAdminCalendarEvent(id);
  if (!event) throw new AdminCalendarServiceError("not_found");
  return event;
}

/**
 * Calendar Event全体のSnapshotを保存し、公開状態は維持します。
 * @param id
 * @param value
 * @returns 更新されたCalendar Event。
 */
export async function updateAdminCalendarEvent(id: string, value: unknown): Promise<AdminCalendarEvent> {
  const parsed = parseWriteInput(value, id);
  const publishReady = getCalendarPublicationMissingFields(parsed.input).length === 0;
  let result;
  try {
    result = await updateCalendarEvent(id, parsed.input, publishReady);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminCalendarServiceError("conflict", { id: "invalid_format" });
    throw error;
  }
  if (result === "not_found") throw new AdminCalendarServiceError("not_found");
  if (result === "publication_blocked") {
    throw new AdminCalendarServiceError(
      "publication_requirements_not_met",
      {},
      getCalendarPublicationMissingFields(parsed.input),
    );
  }
  return readAdminCalendarEvent(id);
}

/**
 * Calendar Eventを削除します。
 * @param id
 * @returns 削除前の公開状態を含む削除結果。対象がなければ業務エラー。
 */
export async function deleteAdminCalendarEvent(id: string): Promise<CalendarEventDeleteResult> {
  const result = await deleteCalendarEvent(id);
  if (!result) throw new AdminCalendarServiceError("not_found");
  return result;
}
/** Issue #412の後方互換Delete API名です。 */
export const removeAdminCalendarEvent = deleteAdminCalendarEvent;

/**
 * Calendar Eventを公開またはDraftへ変更します。
 * @param id
 * @param isPublished
 * @returns 公開状態変更結果。
 */
export async function changeAdminCalendarEventPublication(
  id: string,
  isPublished: boolean,
): Promise<Awaited<ReturnType<typeof setCalendarEventPublication>>> {
  if (typeof isPublished !== "boolean") throw new AdminCalendarServiceError("validation");
  const current = await readAdminCalendarEvent(id);
  if (isPublished) {
    const missingFields = getCalendarPublicationMissingFields(current);
    if (missingFields.length > 0)
      throw new AdminCalendarServiceError("publication_requirements_not_met", {}, missingFields);
  }
  const result = await setCalendarEventPublication(id, isPublished);
  if (!result) throw new AdminCalendarServiceError("not_found");
  if (isPublished && !result.isPublished) {
    const latest = await readAdminCalendarEvent(id);
    throw new AdminCalendarServiceError(
      "publication_requirements_not_met",
      {},
      getCalendarPublicationMissingFields(latest),
    );
  }
  return result;
}

/**
 * Calendar Eventを公開します。
 * @param id
 * @returns 公開状態変更結果。
 */
export function publishAdminCalendarEvent(id: string) {
  return changeAdminCalendarEventPublication(id, true);
}
/** Issue #412の公開状態変更API名です。 */
export const changeAdminCalendarPublication = changeAdminCalendarEventPublication;

/**
 * Calendar EventをDraftへ戻します。
 * @param id
 * @returns 公開状態変更結果。
 */
export function unpublishAdminCalendarEvent(id: string) {
  return changeAdminCalendarEventPublication(id, false);
}

export { getCalendarPublicationMissingFields } from "./calendar/publication";

function parseWriteInput(value: unknown, expectedId?: string): { id: string | null; input: AdminCalendarWriteInput } {
  const source = asRecord(value);
  const fieldErrors: FieldErrors = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) fieldErrors.input = "invalid_type";
  const id =
    expectedId !== undefined && source.id === undefined
      ? expectedId
      : parseId(source.id, "id", fieldErrors, expectedId === undefined);
  if (expectedId !== undefined && source.id !== undefined && id !== expectedId) fieldErrors.id = "immutable";
  const input = {
    category: parseCategory(source.category, fieldErrors),
    dateRule: parseDateRule(source.dateRule, fieldErrors),
    isPublicHoliday: parseBoolean(source.isPublicHoliday, "isPublicHoliday", fieldErrors),
    featured: parseBoolean(source.featured, "featured", fieldErrors),
    aliases: parseAliases(source.aliases, fieldErrors),
    source: parseNullableText(source.source, "source", fieldErrors),
    translations: parseTranslations(source.translations, fieldErrors),
  } satisfies AdminCalendarWriteInput;
  if (Object.keys(fieldErrors).length > 0) throw new AdminCalendarServiceError("validation", fieldErrors);
  return { id: expectedId ?? id, input };
}

function parseId(value: unknown, field: string, errors: FieldErrors, required: boolean): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) errors[field] = "required";
    return null;
  }
  if (typeof value !== "string") {
    errors[field] = "invalid_type";
    return null;
  }
  if (value !== value.trim()) errors[field] = "leading_or_trailing_space";
  else if (!isCalendarEventId(value)) errors[field] = "invalid_format";
  return value;
}

function parseCategory(value: unknown, errors: FieldErrors): CalendarCategory | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !CATEGORIES.includes(value as CalendarCategory)) {
    errors.category = "invalid_format";
    return null;
  }
  return value as CalendarCategory;
}

function parseDateRule(value: unknown, errors: FieldErrors): CalendarDateRuleDefinition | null {
  if (value === undefined || value === null || value === "") return null;
  try {
    return parseCalendarDateRuleDefinition(value, "dateRule");
  } catch {
    errors.dateRule = "invalid_format";
    return null;
  }
}

function parseBoolean(value: unknown, field: string, errors: FieldErrors): boolean {
  if (value === undefined || value === null || value === "") {
    errors[field] = "invalid_type";
    return false;
  }
  if (typeof value !== "boolean") errors[field] = "invalid_type";
  return typeof value === "boolean" ? value : false;
}

function parseAliases(value: unknown, errors: FieldErrors): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    errors.aliases = "invalid_type";
    return [];
  }
  const aliases = value.map((item, index) => {
    if (typeof item !== "string") {
      errors["aliases." + index] = "invalid_type";
      return "";
    }
    const alias = item.trim();
    if (!alias) errors["aliases." + index] = "invalid_format";
    return alias;
  });
  const seen = new Set<string>();
  aliases.forEach((alias, index) => {
    if (alias && seen.has(alias)) errors["aliases." + index] = "invalid_format";
    seen.add(alias);
  });
  return aliases;
}

function parseNullableText(value: unknown, field: string, errors: FieldErrors): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    errors[field] = "invalid_type";
    return null;
  }
  return value.trim() || null;
}

function parseTranslations(value: unknown, errors: FieldErrors) {
  const source = asRecord(value);
  return {
    ja: parseTranslation(source.ja, "ja", errors),
    en: parseTranslation(source.en, "en", errors),
  };
}

function parseTranslation(value: unknown, locale: "ja" | "en", errors: FieldErrors) {
  const source = asRecord(value);
  return {
    name: parseText(source.name, "translations." + locale + ".name", errors),
    description: parseText(source.description, "translations." + locale + ".description", errors),
  };
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

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
