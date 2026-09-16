import { neon, type NeonQueryFunctionInTransaction } from "@neondatabase/serverless";
import { isCalendarEventId, parseCalendarDateRule, parseCalendarDateRuleDefinition } from "./validation";
import { rejectE2ETestMutation } from "../e2e-test-mode";
import type {
  AdminCalendarEvent,
  AdminCalendarListItem,
  AdminCalendarWriteInput,
  CalendarCategory,
  CalendarDateRule,
  CalendarDateRuleDefinition,
  CalendarEvent,
} from "./types";

type DbRow = Record<string, unknown>;
type QueryClient = { query: (text: string, params?: unknown[]) => Promise<unknown> };
const CATEGORIES = [
  "public_holiday",
  "culture",
  "tradition",
  "language",
  "literature",
  "history",
  "religion",
] as const satisfies readonly CalendarCategory[];
const LOCALES = ["ja", "en"] as const;

/** 管理Event全体更新の業務結果です。 */
export type CalendarEventUpdateResult = "updated" | "not_found" | "publication_blocked";

/** 管理Event公開状態変更の業務結果です。 */
export type CalendarEventPublicationResult = Readonly<{
  id: string;
  isPublished: boolean;
  unchanged: boolean;
}>;

/** 管理Event削除結果です。 */
export type CalendarEventDeleteResult = Readonly<{
  id: string;
  wasPublished: boolean;
}>;

let sqlClient: ReturnType<typeof neon> | null = null;

/**
 * 公開済みEventだけを、DB値を検証して取得します。
 * @returns 検証済みの公開Calendar Event一覧。
 */
export async function getPublishedCalendarEvents(): Promise<readonly CalendarEvent[]> {
  if (!process.env.DATABASE_URL) return [];
  const rows = await queryRows(
    getRequiredSql(),
    "SELECT event.id, event.category, event.date_rule, event.is_public_holiday, event.featured, event.aliases, event.source, " +
      "ja.name AS name_ja, ja.description AS description_ja, en.name AS name_en, en.description AS description_en " +
      "FROM calendar_events AS event " +
      "JOIN calendar_event_translations AS ja ON ja.event_id = event.id AND ja.locale = 'ja' " +
      "JOIN calendar_event_translations AS en ON en.event_id = event.id AND en.locale = 'en' " +
      "WHERE event.is_published = TRUE ORDER BY event.sort_order, event.id",
  );
  return parsePublishedCalendarRows(rows);
}

/**
 * DraftとPublishedを含む管理Event一覧を更新日時順で取得します。
 * @returns 管理Calendar Event一覧。
 */
export async function listAdminCalendarEvents(): Promise<readonly AdminCalendarListItem[]> {
  if (!process.env.DATABASE_URL) return [];
  const rows = await queryRows(
    getRequiredSql(),
    "SELECT event.id, event.category, event.date_rule, event.is_public_holiday, event.featured, event.aliases, event.source, " +
      "event.sort_order, event.is_published, event.created_at::text, event.updated_at::text, " +
      "COALESCE(ja.name, '') AS name_ja, COALESCE(en.name, '') AS name_en " +
      "FROM calendar_events AS event " +
      "LEFT JOIN calendar_event_translations AS ja ON ja.event_id = event.id AND ja.locale = 'ja' " +
      "LEFT JOIN calendar_event_translations AS en ON en.event_id = event.id AND en.locale = 'en' " +
      "ORDER BY event.updated_at DESC, event.id",
  );
  return rows.map(parseAdminCalendarListRow);
}

/**
 * 指定IDの管理Eventを日英翻訳とともに取得します。
 * @param id
 * @returns 管理Calendar Event。未存在時はnull。
 */
export async function getAdminCalendarEvent(id: string): Promise<AdminCalendarEvent | null> {
  requiredId(id);
  if (!process.env.DATABASE_URL) return null;
  const rows = await queryRows(
    getRequiredSql(),
    "SELECT event.id, event.category, event.date_rule, event.is_public_holiday, event.featured, event.aliases, event.source, " +
      "event.sort_order, event.is_published, event.created_at::text, event.updated_at::text, " +
      "COALESCE(ja.name, '') AS name_ja, COALESCE(ja.description, '') AS description_ja, " +
      "COALESCE(en.name, '') AS name_en, COALESCE(en.description, '') AS description_en " +
      "FROM calendar_events AS event " +
      "LEFT JOIN calendar_event_translations AS ja ON ja.event_id = event.id AND ja.locale = 'ja' " +
      "LEFT JOIN calendar_event_translations AS en ON en.event_id = event.id AND en.locale = 'en' " +
      "WHERE event.id = $1",
    [id],
  );
  return rows.length === 0 ? null : parseAdminCalendarRow(rows[0]);
}

/**
 * Event本体と日英翻訳を同一Transactionで作成します。
 * @param id
 * @param input
 * @returns 保存完了時に解決するPromise。
 */
export async function insertCalendarEvent(id: string, input: AdminCalendarWriteInput): Promise<void> {
  rejectE2ETestMutation();
  requiredId(id);
  validateWriteInput(input);
  const sql = getRequiredSql();
  await sql.transaction((transaction) => [
    transactionQuery(transaction, "LOCK TABLE calendar_events IN SHARE ROW EXCLUSIVE MODE", []),
    transactionQuery(
      transaction,
      "INSERT INTO calendar_events " +
        "(id, category, date_rule, is_public_holiday, featured, aliases, source, sort_order) " +
        "VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM calendar_events))",
      [
        id,
        input.category,
        input.dateRule === null ? null : JSON.stringify(serializeDateRule(input.dateRule)),
        input.isPublicHoliday,
        input.featured,
        [...input.aliases],
        input.source,
      ],
    ),
    ...translationQueries(transaction, id, input),
  ]);
}

/**
 * Event本体と日英翻訳を同一Transactionで全体更新します。
 * @param id
 * @param input
 * @param publishReady
 * @returns 更新結果。
 */
export async function updateCalendarEvent(
  id: string,
  input: AdminCalendarWriteInput,
  publishReady = isPublicationReady(input),
): Promise<CalendarEventUpdateResult> {
  rejectE2ETestMutation();
  requiredId(id);
  validateWriteInput(input);
  const sql = getRequiredSql();
  const results = (await sql.transaction((transaction) => [
    transactionQuery(transaction, "SELECT id, is_published FROM calendar_events WHERE id = $1 FOR UPDATE", [id]),
    transactionQuery(
      transaction,
      "UPDATE calendar_events SET category = $2, date_rule = $3::jsonb, is_public_holiday = $4, featured = $5, " +
        "aliases = $6, source = $7, updated_at = NOW() " +
        "WHERE id = $1 AND (is_published = FALSE OR $8 = TRUE) RETURNING id",
      [
        id,
        input.category,
        input.dateRule === null ? null : JSON.stringify(serializeDateRule(input.dateRule)),
        input.isPublicHoliday,
        input.featured,
        [...input.aliases],
        input.source,
        publishReady,
      ],
    ),
    ...translationQueries(transaction, id, input, publishReady),
  ])) as unknown as DbRow[][];
  if (results[0].length === 0) return "not_found";
  if (results[1].length === 0) return "publication_blocked";
  return "updated";
}

/**
 * Eventと翻訳を外部キーのCASCADEで削除します。
 * @param id
 * @returns 削除結果。未存在時はnull。
 */
export async function deleteCalendarEvent(id: string): Promise<CalendarEventDeleteResult | null> {
  rejectE2ETestMutation();
  requiredId(id);
  const rows = await queryRows(
    getRequiredSql(),
    "DELETE FROM calendar_events WHERE id = $1 RETURNING id, is_published",
    [id],
  );
  return rows.length === 0 ? null : { id: requiredId(rows[0].id), wasPublished: requiredBoolean(rows[0].is_published) };
}

/**
 * 行ロックと公開条件のDB再検証を伴って公開状態を変更します。
 * @param id
 * @param isPublished
 * @returns 公開状態変更結果。未存在時はnull。
 */
export async function setCalendarEventPublication(
  id: string,
  isPublished: boolean,
): Promise<CalendarEventPublicationResult | null> {
  rejectE2ETestMutation();
  requiredId(id);
  if (typeof isPublished !== "boolean") throw new Error("Invalid calendar publication input.");
  const sql = getRequiredSql();
  const results = (await sql.transaction((transaction) => [
    transactionQuery(transaction, "SELECT id, is_published FROM calendar_events WHERE id = $1 FOR UPDATE", [id]),
    transactionQuery(
      transaction,
      "UPDATE calendar_events SET is_published = $2, updated_at = NOW() " +
        "WHERE id = $1 AND is_published <> $2 AND ($2 = FALSE OR " +
        "(category IS NOT NULL AND date_rule IS NOT NULL AND EXISTS " +
        "(SELECT 1 FROM calendar_event_translations WHERE event_id = id AND locale = 'ja' AND btrim(name) <> '') " +
        "AND EXISTS (SELECT 1 FROM calendar_event_translations WHERE event_id = id AND locale = 'en' AND btrim(name) <> ''))) RETURNING id, is_published",
      [id, isPublished],
    ),
  ])) as unknown as DbRow[][];
  if (results[0].length === 0) return null;
  const current = requiredBoolean(results[0][0].is_published);
  if (results[1].length === 0) return { id, isPublished: current, unchanged: true };
  return { id, isPublished: requiredBoolean(results[1][0].is_published), unchanged: false };
}

/**
 * 公開Repositoryが返すDB行をCalendarEventへ変換します。
 * @param row
 * @returns 公開用Calendar Event。
 */
export function parsePublishedCalendarRow(row: DbRow): CalendarEvent {
  const id = requiredId(row.id);
  const category = requiredCategory(row.category);
  const date = requiredDateRule(row.date_rule);
  const aliases = parseAliases(row.aliases);
  const source = nullableString(row.source);
  return {
    id,
    name: { ja: requiredNonEmptyString(row.name_ja), en: requiredNonEmptyString(row.name_en) },
    date,
    category,
    isPublicHoliday: requiredBoolean(row.is_public_holiday),
    featured: requiredBoolean(row.featured),
    description: { ja: requiredString(row.description_ja), en: requiredString(row.description_en) },
    ...(aliases.length > 0 ? { aliases } : {}),
    ...(source !== null ? { source } : {}),
  };
}

/**
 * 公開RepositoryのDB行一覧を検証します。
 * @param rows
 * @returns 検証済み公開Event一覧。
 */
export function parsePublishedCalendarRows(rows: readonly DbRow[]): readonly CalendarEvent[] {
  return rows.map(parsePublishedCalendarRow);
}

/**
 * 管理一覧のDB行を検証します。
 * @param row
 * @returns 管理一覧Item。
 */
export function parseAdminCalendarListRow(row: DbRow): AdminCalendarListItem {
  return { ...parseAdminBase(row), nameJa: requiredString(row.name_ja), nameEn: requiredString(row.name_en) };
}

/**
 * 管理詳細のDB行を検証します。
 * @param row
 * @returns 管理Calendar Event。
 */
export function parseAdminCalendarRow(row: DbRow): AdminCalendarEvent {
  return {
    ...parseAdminBase(row),
    translations: {
      ja: { name: requiredString(row.name_ja), description: requiredString(row.description_ja) },
      en: { name: requiredString(row.name_en), description: requiredString(row.description_en) },
    },
  };
}

/**
 * DATABASE_URLが設定されているかを返します。
 * @returns DB設定済みの場合はtrue。
 */
export function isCalendarDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function parseAdminBase(row: DbRow) {
  return {
    id: requiredId(row.id),
    category: nullableCategory(row.category),
    dateRule: nullableDateRule(row.date_rule),
    isPublicHoliday: requiredBoolean(row.is_public_holiday),
    featured: requiredBoolean(row.featured),
    aliases: parseAliases(row.aliases),
    source: nullableString(row.source),
    sortOrder: requiredNonNegativeInteger(row.sort_order),
    isPublished: requiredBoolean(row.is_published),
    createdAt: requiredString(row.created_at),
    updatedAt: requiredString(row.updated_at),
  };
}

function translationQueries(
  transaction: NeonQueryFunctionInTransaction<boolean, boolean>,
  id: string,
  input: AdminCalendarWriteInput,
  publishReady = true,
) {
  return LOCALES.map((locale) => {
    const translation = input.translations[locale];
    return transactionQuery(
      transaction,
      "INSERT INTO calendar_event_translations (event_id, locale, name, description) " +
        "SELECT $1, $2, $3, $4 WHERE $5 = TRUE OR EXISTS " +
        "(SELECT 1 FROM calendar_events AS event WHERE event.id = $1 AND event.is_published = FALSE) " +
        "ON CONFLICT (event_id, locale) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = NOW()",
      [id, locale, translation.name, translation.description, publishReady],
    );
  });
}

function serializeDateRule(rule: CalendarDateRuleDefinition): Record<string, unknown> {
  if (rule.type === "rule_set") {
    return {
      type: rule.type,
      rules: rule.rules.map((item) => ({
        when: item.when,
        use: serializeDateRule(item.use),
      })),
    };
  }
  return { ...rule };
}

function validateWriteInput(input: AdminCalendarWriteInput): void {
  if (input.category !== null && !CATEGORIES.includes(input.category)) throw new Error("Invalid calendar write input.");
  if (input.dateRule !== null) parseCalendarDateRuleDefinition(input.dateRule, "dateRule");
  if (typeof input.isPublicHoliday !== "boolean" || typeof input.featured !== "boolean")
    throw new Error("Invalid calendar write input.");
  if (!Array.isArray(input.aliases) || input.aliases.some((value) => typeof value !== "string"))
    throw new Error("Invalid calendar write input.");
  const aliases = input.aliases.map((value) => value.trim());
  if (aliases.some((value) => value.length === 0) || new Set(aliases).size !== aliases.length)
    throw new Error("Invalid calendar write input.");
  if (input.source !== null && typeof input.source !== "string") throw new Error("Invalid calendar write input.");
  for (const locale of LOCALES) {
    const translation = input.translations[locale];
    if (!translation || typeof translation.name !== "string" || typeof translation.description !== "string")
      throw new Error("Invalid calendar write input.");
  }
}

function isPublicationReady(input: AdminCalendarWriteInput): boolean {
  return Boolean(input.category && input.dateRule && LOCALES.every((locale) => input.translations[locale].name.trim()));
}

function requiredId(value: unknown): string {
  if (typeof value !== "string" || !isCalendarEventId(value)) throw invalidDatabaseCalendar();
  return value;
}

function requiredCategory(value: unknown): CalendarCategory {
  if (typeof value !== "string" || !CATEGORIES.includes(value as CalendarCategory)) throw invalidDatabaseCalendar();
  return value as CalendarCategory;
}

function nullableCategory(value: unknown): CalendarCategory | null {
  if (value === null || value === undefined) return null;
  return requiredCategory(value);
}

function requiredDateRule(value: unknown): CalendarDateRule {
  if (value === null || value === undefined) throw invalidDatabaseCalendar();
  try {
    return parseCalendarDateRule(typeof value === "string" ? JSON.parse(value) : value, "date_rule");
  } catch {
    throw invalidDatabaseCalendar();
  }
}

function nullableDateRule(value: unknown): CalendarDateRuleDefinition | null {
  if (value === null || value === undefined) return null;
  try {
    return parseCalendarDateRuleDefinition(typeof value === "string" ? JSON.parse(value) : value, "date_rule");
  } catch {
    throw invalidDatabaseCalendar();
  }
}

function parseAliases(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw invalidDatabaseCalendar();
  return value.map((item) => item);
}

function requiredString(value: unknown): string {
  if (typeof value !== "string") throw invalidDatabaseCalendar();
  return value;
}

function requiredNonEmptyString(value: unknown): string {
  const result = requiredString(value);
  if (!result.trim()) throw invalidDatabaseCalendar();
  return result;
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return requiredString(value);
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw invalidDatabaseCalendar();
  return value;
}

function requiredNonNegativeInteger(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw invalidDatabaseCalendar();
  return value as number;
}

function invalidDatabaseCalendar(): Error {
  return new Error("Invalid calendar event returned from database.");
}

function queryRows(client: QueryClient, text: string, params: unknown[] = []): Promise<DbRow[]> {
  return client.query(text, params) as Promise<DbRow[]>;
}

function transactionQuery(
  transaction: NeonQueryFunctionInTransaction<boolean, boolean>,
  text: string,
  params: unknown[],
) {
  const strings = text.split(/\$\d+/u) as unknown as TemplateStringsArray;
  Object.defineProperty(strings, "raw", { value: strings });
  return transaction(strings, ...params);
}

/** Issue #412のPublic Repository API名です。 */
export const listPublishedCalendarEvents = getPublishedCalendarEvents;

/** Issue #412のAdmin Create API名です。 */
export const insertAdminCalendarEvent = insertCalendarEvent;

/**
 * Issue #412のAdmin Update API名です。
 * @param id
 * @param input
 * @param publishReady
 * @returns 更新結果。
 */
export function replaceAdminCalendarEvent(id: string, input: AdminCalendarWriteInput, publishReady: boolean) {
  return updateCalendarEvent(id, input, publishReady);
}

/** Issue #412のAdmin Publication API名です。 */
export const setAdminCalendarPublication = setCalendarEventPublication;

/** Issue #412のAdmin Delete API名です。 */
export const removeAdminCalendarEvent = deleteCalendarEvent;

function getRequiredSql(): ReturnType<typeof neon> {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  sqlClient ??= neon(process.env.DATABASE_URL);
  return sqlClient;
}
