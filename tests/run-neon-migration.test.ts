import { describe, expect, it } from "vitest";
import { parseMigrationArguments, prepareMigrationSql } from "../scripts/run-neon-migration.mjs";

describe("prepareMigrationSql", () => {
  it("removes the psql-only ON_ERROR_STOP command before using Neon Client", () => {
    expect(prepareMigrationSql("\\set ON_ERROR_STOP on\n\nBEGIN;\nCOMMIT;\n")).toBe("\nBEGIN;\nCOMMIT;\n");
  });

  it("preserves SQL and unrelated psql commands", () => {
    const sql = "SELECT 1;\n\\echo keep this line\n";
    expect(prepareMigrationSql(sql)).toBe(sql);
  });
});

describe("parseMigrationArguments", () => {
  it("requires explicit production confirmation", () => {
    expect(() => parseMigrationArguments(["--target", "production", "db/migration.sql"])).toThrow(
      "Production migration requires --confirm-production.",
    );
    expect(parseMigrationArguments(["--target", "production", "--confirm-production", "db/migration.sql"])).toEqual({
      target: "production",
      migrationPath: "db/migration.sql",
    });
  });

  it("requires an explicit target and rejects production confirmation for Preview", () => {
    expect(() => parseMigrationArguments(["db/migration.sql"])).toThrow("Usage:");
    expect(() => parseMigrationArguments(["--target", "preview", "--confirm-production", "db/migration.sql"])).toThrow(
      "--confirm-production is only valid for production.",
    );
  });
});
