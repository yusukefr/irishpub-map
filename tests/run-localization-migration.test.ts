import { describe, expect, it } from "vitest";
import { getLocalizationMigrationFiles } from "../scripts/run-localization-migration.mjs";

describe("getLocalizationMigrationFiles", () => {
  it("prepares the schema migration and its verification in order", () => {
    expect(getLocalizationMigrationFiles("prepare")).toEqual([
      "db/migrations/006_localize_display_data_up.sql",
      "db/migrations/006_localize_display_data_verify.sql",
    ]);
  });

  it("finalizes localization by deleting legacy display columns", () => {
    expect(getLocalizationMigrationFiles("finalize")).toEqual([
      "db/migrations/007_finalize_localization_up.sql",
      "db/migrations/007_finalize_localization_verify.sql",
    ]);
  });
});
