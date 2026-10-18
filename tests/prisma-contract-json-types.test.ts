import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("db/prisma/contract.prisma", "utf8");
const artifact = JSON.parse(readFileSync("generated/prisma8/contract.json", "utf8"));
const types = readFileSync("generated/prisma8/contract.d.ts", "utf8");
const tables = artifact.storage.namespaces.public.entries.table;

describe("Prisma 8 Contract physical JSON types", () => {
  it("keeps Production jsonb columns as jsonb in both source and generated artifacts", () => {
    const expected = [
      ["AutomationIdempotencyKeys", "automation_idempotency_keys", "response_body"],
      ["CalendarEvents", "calendar_events", "date_rule"],
    ] as const;

    for (const [model, table, column] of expected) {
      const block = source.match(new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, "m"));
      expect(block, `missing model ${model}`).not.toBeNull();
      expect(block?.[1]).toMatch(new RegExp(`^\\s*${column}\\s+Jsonb\\?`, "m"));
      expect(tables[table].columns[column]).toMatchObject({
        codecId: "pg/jsonb@1",
        dataType: "pg/jsonb",
        nullable: true,
      });
      expect(artifact.domain.namespaces.public.models[model].fields[column].type.codecId).toBe("pg/jsonb@1");
    }
  });

  it("keeps the generated TypeScript brand in sync with the JSON storage hash", () => {
    expect(types).toContain(`export type StorageHash = StorageHashBase<"${artifact.storage.storageHash}">;`);
  });
});
