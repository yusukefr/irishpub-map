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
    expect(verifySql).toContain("unsupported_calendar_locales");
    expect(verifySql).toContain("orphan_calendar_translations");
    expect(verifySql).toContain("calendar_domain_migration_recorded");
  });
});
