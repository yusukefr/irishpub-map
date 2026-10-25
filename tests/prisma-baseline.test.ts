import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const baselineName = readdirSync("migrations/app").find((name) => name.endsWith("_baseline"));
if (!baselineName) throw new Error("Prisma baseline migration directory is missing");
const migrationDir = `migrations/app/${baselineName}`;
const operations = JSON.parse(readFileSync(`${migrationDir}/ops.json`, "utf8")) as Array<{
  id: string;
  execute: Array<{ sql: string }>;
}>;
const migration = readFileSync(`${migrationDir}/migration.ts`, "utf8");
const referenceSeed = readFileSync("db/prisma/seed-reference-data.sql", "utf8");
const allSql = operations.flatMap((operation) => operation.execute.map((step) => step.sql)).join("\n");

describe("Prisma 8 baseline", () => {
  it("recreates the emitted Application schema without copying the legacy ledger", () => {
    expect(operations).toHaveLength(78);
    expect(operations.filter(({ id }) => id.startsWith("table."))).toHaveLength(24);
    expect(operations.filter(({ id }) => id.startsWith("foreignKey."))).toHaveLength(22);
    expect(operations.filter(({ id }) => id.startsWith("index."))).toHaveLength(21);
    expect(allSql.match(/CONSTRAINT "[^"]+_check" CHECK/g) ?? []).toHaveLength(60);
    expect(allSql).not.toContain("schema_migrations");
    expect(migration).not.toContain("schema_migrations");
  });

  it("preserves the Contract as its end state", () => {
    const manifest = JSON.parse(readFileSync(`${migrationDir}/migration.json`, "utf8")) as {
      from: string | null;
      to: string;
    };
    const contract = JSON.parse(readFileSync("generated/prisma8/contract.json", "utf8")) as {
      storage: { storageHash: string };
    };

    expect(manifest.from).toBeNull();
    expect(manifest.to).toBe(contract.storage.storageHash);
  });

  it("seeds only reproducible reference rows and requires municipality source data", () => {
    expect(referenceSeed).toContain("data/市区町村コード.csv");
    expect(referenceSeed).toContain("reference-data seed requires an empty application database");
    expect(referenceSeed).toContain("INSERT INTO prefecture_translations");
    expect(referenceSeed).toContain("INSERT INTO municipality_translations");
    expect(referenceSeed).toContain("INSERT INTO pub_status_translations");
    expect(referenceSeed).toContain("INSERT INTO pub_type_translations");
    expect(referenceSeed).not.toMatch(/INSERT INTO (pubs|pub_tags|pub_translations|quiz_questions|content_entries)/i);
  });
});
