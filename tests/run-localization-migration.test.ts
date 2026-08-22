import { describe, expect, it } from "vitest";
import { getLocalizationMigrationFiles } from "../scripts/run-localization-migration.mjs";

describe("getLocalizationMigrationFiles", () => {
  it("prepares the schema migration and its verification in order", () => {
    expect(getLocalizationMigrationFiles("prepare")).toEqual([
      "db/migrations/006_localize_display_data_up.sql",
      "db/migrations/006_localize_display_data_verify.sql",
    ]);
  });

  it("rejects an unknown phase before running SQL", () => {
    expect(() => getLocalizationMigrationFiles("finalize")).toThrow("Unknown localization migration phase");
  });
});
