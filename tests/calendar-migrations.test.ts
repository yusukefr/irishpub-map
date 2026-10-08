import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function readMigration(name: string) {
  return readFile(resolve(process.cwd(), "db/migrations", name), "utf8");
}

describe("calendar database migration", () => {
  it("defines the Calendar tables, constraints, indexes, and migration history", async () => {
    const upSql = await readMigration("013_add_calendar_domain_up.sql");
    const verifySql = await readMigration("013_add_calendar_domain_verify.sql");

    expect(upSql).toContain("CREATE TABLE calendar_events");
    expect(upSql).toContain("CREATE TABLE calendar_event_translations");
    expect(upSql).toContain("id TEXT PRIMARY KEY CHECK (btrim(id) <> '' AND id = btrim(id))");
    expect(upSql).toContain("date_rule JSONB CHECK");
    expect(upSql).toContain("jsonb_typeof(date_rule->'type') = 'string'");
    expect(upSql).toContain("aliases TEXT[] NOT NULL DEFAULT '{}'::TEXT[]");
    expect(upSql).toContain("PRIMARY KEY (event_id, locale)");
    expect(upSql).toContain("CHECK (locale IN ('ja', 'en'))");
    expect(upSql).toContain("ON DELETE CASCADE");
    expect(upSql).toContain("CHECK (sort_order >= 0)");
    expect(upSql).toContain("calendar_events_published_idx");
    expect(upSql).toContain("calendar_events_category_idx");
    expect(upSql).toContain("calendar_events_admin_list_idx");
    expect(upSql).toContain("calendar_events_sort_order_idx");
    expect(upSql).toContain("VALUES ('013_add_calendar_domain')");
    expect(upSql).not.toContain("CREATE TABLE IF NOT EXISTS calendar_events");

    expect(verifySql).toContain("calendar_columns");
    expect(verifySql).toContain("calendar_constraints");
    expect(verifySql).toContain("calendar_indexes");
    expect(verifySql).toContain("invalid_calendar_date_rules");
    expect(verifySql).toContain("jsonb_typeof(date_rule->'type') IS DISTINCT FROM 'string'");
    expect(verifySql).toContain("unsupported_calendar_locales");
    expect(verifySql).toContain("orphan_calendar_translations");
    expect(verifySql).toContain("calendar_domain_migration_recorded");
  });

  it("TEXT IDにDB生成UUIDのDEFAULTを追加し、履歴と型を検証する", async () => {
    const upSql = await readMigration("019_add_calendar_event_id_default_up.sql");
    const verifySql = await readMigration("019_add_calendar_event_id_default_verify.sql");

    expect(upSql).toContain("ALTER COLUMN id SET DEFAULT gen_random_uuid()::text");
    expect(upSql).toContain("VALUES ('019_add_calendar_event_id_default')");
    expect(upSql).not.toContain("ALTER COLUMN id TYPE uuid");
    expect(verifySql).toContain("data_type = 'text'");
    expect(verifySql).toContain("column_default IN ('gen_random_uuid()::text', '(gen_random_uuid())::text')");
    expect(verifySql).toContain("version = '019_add_calendar_event_id_default'");
  });

  it("Calendar Event IDをUUIDへ変換し、行数・参照・制約を検証する", async () => {
    const upSql = await readMigration("022_convert_calendar_event_ids_to_uuid_up.sql");
    const verifySql = await readMigration("022_convert_calendar_event_ids_to_uuid_verify.sql");

    expect(upSql).toContain("CREATE TEMP TABLE calendar_event_id_map");
    expect(upSql).toContain("THEN id::uuid");
    expect(upSql).toContain("ELSE gen_random_uuid()");
    expect(upSql).toContain("UPDATE calendar_event_translations AS translation SET event_id_uuid = mapping.new_id");
    expect(upSql).toContain("ALTER COLUMN id DROP DEFAULT");
    expect(upSql).toContain("row counts or translation references changed");
    expect(upSql).toContain("VALUES ('022_convert_calendar_event_ids_to_uuid')");
    expect(verifySql).toContain("data_type = 'uuid'");
    expect(verifySql).toContain("calendar_events.id must not have a default");
    expect(verifySql).toContain("orphaned parent");
    expect(verifySql).toContain("calendar event index is missing");
  });
});
