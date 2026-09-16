import { describe, expect, it } from "vitest";
import { prepareMigrationSql } from "../scripts/run-neon-migration.mjs";

describe("prepareMigrationSql", () => {
  it("removes the psql-only ON_ERROR_STOP command before using Neon Client", () => {
    expect(prepareMigrationSql("\\set ON_ERROR_STOP on\n\nBEGIN;\nCOMMIT;\n")).toBe("\nBEGIN;\nCOMMIT;\n");
  });

  it("preserves SQL and unrelated psql commands", () => {
    const sql = "SELECT 1;\n\\echo keep this line\n";
    expect(prepareMigrationSql(sql)).toBe(sql);
  });
});
