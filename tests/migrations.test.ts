import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function readMigration(name: string) {
  return readFile(resolve(process.cwd(), "db/migrations", name), "utf8");
}

describe("pubs database migrations", () => {
  it("moves legacy JSONB rows into independent columns with a UUID map", async () => {
    const sql = await readMigration("001_pubs_columns_up.sql");

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS pubs_jsonb_backup_20260815 AS TABLE pubs");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS pub_id_migration_map");
    expect(sql).toContain("CREATE TABLE pubs_columns_new");
    expect(sql).toContain("id UUID PRIMARY KEY");
    expect(sql).toContain("tags TEXT[]");
    expect(sql).toContain("CREATE INDEX pubs_tags_gin_idx");
    expect(sql).toContain("ALTER TABLE pubs RENAME TO pubs_jsonb_legacy_20260815");
    expect(sql).not.toContain("INSERT INTO pubs (id, data)");
  });

  it("provides post-migration checks and a guarded rollback", async () => {
    const verifySql = await readMigration("001_pubs_columns_verify.sql");
    const downSql = await readMigration("001_pubs_columns_down.sql");

    expect(verifySql).toContain("missing_migrated_rows");
    expect(verifySql).toContain("legacy_jsonb_dependency");
    expect(downSql).toContain("pubs_jsonb_legacy_20260815");
    expect(downSql).toContain("pubs_columns_rolled_back_20260815");
    expect(downSql).toContain("RAISE EXCEPTION");
  });

  it("defines the normalized metadata migration, verification, and rollback", async () => {
    const upSql = await readMigration("002_normalize_pub_metadata_up.sql");
    const verifySql = await readMigration("002_normalize_pub_metadata_verify.sql");
    const downSql = await readMigration("002_normalize_pub_metadata_down.sql");

    expect(upSql).toContain("CREATE TABLE IF NOT EXISTS prefectures");
    expect(upSql).toContain("kana TEXT NOT NULL");
    expect(upSql).toContain("CREATE TABLE IF NOT EXISTS pub_statuses");
    expect(upSql).toContain("CREATE TABLE pub_tags");
    expect(upSql).toContain("ALTER TABLE pubs DROP COLUMN prefecture");
    expect(verifySql).toContain("orphan_pub_tags");
    expect(verifySql).toContain("legacy_columns_remaining");
    expect(downSql).toContain("ALTER TABLE pubs ADD COLUMN prefecture");
    expect(downSql).toContain("DROP TABLE pub_tags");
  });

  it("defines the municipality code master migration, CSV import, verification, and rollback", async () => {
    const upSql = await readMigration("003_municipality_codes_up.sql");
    const verifySql = await readMigration("003_municipality_codes_verify.sql");
    const downSql = await readMigration("003_municipality_codes_down.sql");

    expect(upSql).toContain("CREATE TABLE IF NOT EXISTS municipality_codes");
    expect(upSql).toContain("prefecture_code SMALLINT NOT NULL REFERENCES prefectures(code)");
    expect(upSql).toContain("DROP COLUMN IF EXISTS prefecture_name");
    expect(upSql).not.toContain("prefecture_name = EXCLUDED.prefecture_name");
    expect(upSql).not.toContain("prefecture_kana = EXCLUDED.prefecture_kana");
    expect(upSql).toContain("\\copy municipality_codes_import");
    expect(upSql).toContain("data/市区町村コード.csv");
    expect(upSql).toContain("ON CONFLICT (code) DO UPDATE");
    expect(verifySql).toContain("invalid_municipality_codes");
    expect(downSql).toContain("DROP TABLE IF EXISTS municipality_codes");
  });

  it("defines the tag master migration, verification, and rollback", async () => {
    const upSql = await readMigration("004_normalize_pub_tags_up.sql");
    const verifySql = await readMigration("004_normalize_pub_tags_verify.sql");
    const downSql = await readMigration("004_normalize_pub_tags_down.sql");

    expect(upSql).toContain("CREATE TABLE tags");
    expect(upSql).toContain("name TEXT NOT NULL UNIQUE");
    expect(upSql).toContain("tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE");
    expect(upSql).toContain("ALTER TABLE pub_tags RENAME TO pub_tags_legacy_20260816");
    expect(verifySql).toContain("orphan_tag_references");
    expect(verifySql).toContain("duplicate_tag_names");
    expect(downSql).toContain("ALTER TABLE tags RENAME TO tags_normalized_20260816");
    expect(downSql).toContain("CREATE INDEX pub_tags_tag_idx");
  });

  it("defines the final localization migration and verification", async () => {
    const upSql = await readMigration("007_finalize_localization_up.sql");
    const verifySql = await readMigration("007_finalize_localization_verify.sql");

    expect(upSql).toContain(
      "ALTER TABLE pubs DROP COLUMN name, DROP COLUMN kana, DROP COLUMN city, DROP COLUMN address",
    );
    expect(upSql).toContain("Japanese pub translations are incomplete");
    expect(upSql).toContain("INSERT INTO schema_migrations (version) VALUES (\x27007_finalize_localization\x27)");
    expect(verifySql).toContain("legacy_columns_remaining");
    expect(verifySql).toContain("tags_without_ja_translation");
  });

  it("defines the tag name normalization migration, verification, and rollback", async () => {
    const upSql = await readMigration("005_normalize_tag_names_up.sql");
    const verifySql = await readMigration("005_normalize_tag_names_verify.sql");
    const downSql = await readMigration("005_normalize_tag_names_down.sql");

    expect(upSql).toContain("tag_name_normalization_backup_20260817");
    expect(upSql).toContain("ON CONFLICT (pub_id, tag_id) DO NOTHING");
    expect(upSql).toContain("DELETE FROM tags");
    expect(verifySql).toContain("remaining_alias_names");
    expect(verifySql).toContain("duplicate_pub_tag_names");
    expect(downSql).toContain("tag_name_normalization_pub_tags_backup_20260817");
    expect(downSql).toContain("tags_normalized_20260817");
  });
});
