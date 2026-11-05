import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runPrisma, verifyPrismaBaseline } from "../scripts/verify-prisma-baseline.mjs";

const baselineName = readdirSync("migrations/app").find((name) => name.endsWith("_baseline"));
if (!baselineName) throw new Error("Prisma baseline migration directory is missing");
const migrationDir = `migrations/app/${baselineName}`;
const operations = JSON.parse(readFileSync(`${migrationDir}/ops.json`, "utf8")) as Array<{
  id: string;
  execute: Array<{ sql: string }>;
  postcheck: Array<{ sql: string }>;
}>;
const migration = readFileSync(`${migrationDir}/migration.ts`, "utf8");
const referenceSeed = readFileSync("db/prisma/seed-reference-data.sql", "utf8");
const verifyConfig = readFileSync("config/prisma-baseline-verify.config.ts", "utf8");
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

  it("retains DESC index columns and the deferred quiz answer foreign key", () => {
    const operationById = new Map(operations.map((operation) => [operation.id, operation]));
    const expectedIndexes = [
      ["index.automation_audit_logs.automation_audit_logs_created_at_idx", '"created_at" DESC'],
      ["index.calendar_events.calendar_events_admin_list_idx", '"updated_at" DESC, "id" ASC'],
      ["index.media_assets.media_assets_admin_list_idx", '"created_at" DESC, "id" DESC'],
      ["index.quiz_questions.quiz_questions_admin_list_idx", '"updated_at" DESC, "id" ASC'],
    ] as const;

    for (const [id, columns] of expectedIndexes) {
      const operation = operationById.get(id);
      expect(operation?.execute[0]?.sql).toContain(columns);
      expect(operation?.postcheck[0]?.sql).toContain("pg_get_indexdef");
    }

    const foreignKey = operationById.get("foreignKey.quiz_questions.quiz_questions_correct_choice_fkey");
    expect(foreignKey?.execute[0]?.sql).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(foreignKey?.postcheck[0]?.sql).toContain("condeferrable");
    expect(foreignKey?.postcheck[0]?.sql).toContain("condeferred");
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

describe("Prisma baseline verification command", () => {
  const env = {
    PRISMA_SIGNED_DATABASE_BRANCH_ID: "br-signed-check",
    PRISMA_EMPTY_DATABASE_BRANCH_ID: "br-empty-check",
  };
  const branchResponse = JSON.stringify({
    branches: [
      { id: env.PRISMA_SIGNED_DATABASE_BRANCH_ID, name: "verify-signed", current_state: "ready" },
      { id: env.PRISMA_EMPTY_DATABASE_BRANCH_ID, name: "verify-empty", current_state: "ready" },
    ],
  });
  const connections = {
    [env.PRISMA_SIGNED_DATABASE_BRANCH_ID]: "postgresql://ep-signed-check.us-east-1.aws.neon.tech/neondb",
    [env.PRISMA_EMPTY_DATABASE_BRANCH_ID]: "postgresql://ep-empty-check.us-east-1.aws.neon.tech/neondb",
  };
  const appliedStatus = JSON.stringify({
    kind: "result",
    envelope: {
      ok: true,
      diagnostics: [],
      result: { ok: true, diagnostics: [], spaces: [{ migrations: [{ status: "applied" }] }] },
    },
  });

  function runWithStatus(statusOutput: string) {
    const neonCalls: string[][] = [];
    const prismaCalls: Array<{ args: string[]; connection: string }> = [];
    let output = "";
    let errorOutput = "";

    const exitCode = verifyPrismaBaseline({
      env,
      runNeonCommand: (args) => {
        neonCalls.push(args);
        if (args[0] === "branches") return { status: 0, stdout: branchResponse };
        return { status: 0, stdout: connections[args[1] as keyof typeof connections] };
      },
      runPrismaCommand: (args, connection) => {
        prismaCalls.push({ args, connection });
        return { status: 0, stdout: args[1] === "status" ? statusOutput : "" };
      },
      stdout: {
        write: (chunk: string) => {
          output += chunk;
          return true;
        },
      } as NodeJS.WriteStream,
      stderr: {
        write: (chunk: string) => {
          errorOutput += chunk;
          return true;
        },
      } as NodeJS.WriteStream,
    });

    return { exitCode, neonCalls, prismaCalls, output, errorOutput };
  }

  it("passes the database URL through the child environment, not command arguments", () => {
    const databaseUrl = "postgresql://ep-verify-check.neon.tech/neondb";
    let command = "";
    let args: string[] = [];
    let childEnv: NodeJS.ProcessEnv = {};

    const result = runPrisma(
      ["db", "verify", "--json", "--config", "config/prisma-baseline-verify.config.ts"],
      databaseUrl,
      (spawnCommand, spawnArgs, options) => {
        command = spawnCommand;
        args = spawnArgs;
        childEnv = options.env;
        return { status: 0 };
      },
    );

    expect(command).toBe("npm");
    expect(args).toContain("config/prisma-baseline-verify.config.ts");
    expect(args).not.toContain(databaseUrl);
    expect(childEnv.PRISMA_BASELINE_VERIFY_DATABASE_URL).toBe(databaseUrl);
    expect(result.status).toBe(0);
    expect(verifyConfig).toContain("parent: false");
    expect(verifyConfig).toContain('contract: "../db/prisma/contract.prisma"');
    expect(verifyConfig).toContain('migrations: { dir: "../migrations" }');
    expect(verifyConfig).toContain("PRISMA_BASELINE_VERIFY_DATABASE_URL");
  });

  it("resolves distinct ready verification branches and keeps connection URLs out of arguments", () => {
    const { exitCode, neonCalls, prismaCalls, output, errorOutput } = runWithStatus(appliedStatus);

    expect(exitCode).toBe(0);
    expect(neonCalls[0]).toEqual(["branches", "list", "--project-id", "purple-cake-39243248", "--output", "json"]);
    expect(neonCalls).toContainEqual([
      "connection-string",
      env.PRISMA_SIGNED_DATABASE_BRANCH_ID,
      "--project-id",
      "purple-cake-39243248",
    ]);
    expect(prismaCalls).toHaveLength(4);
    expect(prismaCalls.map(({ args }) => args)).toEqual([
      ["db", "verify", "--json", "--config", "config/prisma-baseline-verify.config.ts"],
      ["migration", "status", "--space", "app", "--json", "--config", "config/prisma-baseline-verify.config.ts"],
      ["db", "verify", "--json", "--config", "config/prisma-baseline-verify.config.ts"],
      ["migration", "status", "--space", "app", "--json", "--config", "config/prisma-baseline-verify.config.ts"],
    ]);
    expect(JSON.stringify([...neonCalls, ...prismaCalls.map(({ args }) => args)])).not.toContain("neon.tech");
    expect(output).toContain("signed verification branch: schema and migration status verified.");
    expect(errorOutput).toBe("");
  });

  it("rejects a fixed Preview branch and pooled Neon connections", () => {
    let prismaCalled = false;
    let errorOutput = "";

    const exitCode = verifyPrismaBaseline({
      env,
      runNeonCommand: (args) => {
        if (args[0] === "branches") {
          return {
            status: 0,
            stdout: JSON.stringify({
              branches: [{ id: env.PRISMA_SIGNED_DATABASE_BRANCH_ID, name: "preview", state: "ready" }],
            }),
          };
        }
        return { status: 0, stdout: "" };
      },
      runPrismaCommand: () => {
        prismaCalled = true;
        return { status: 0, stdout: appliedStatus };
      },
      stderr: {
        write: (chunk: string) => {
          errorOutput += chunk;
          return true;
        },
      } as NodeJS.WriteStream,
    });

    expect(exitCode).toBe(2);
    expect(prismaCalled).toBe(false);
    expect(errorOutput).toContain("fixed Preview and Production branches");

    const branchId = env.PRISMA_SIGNED_DATABASE_BRANCH_ID;
    const pooledExit = verifyPrismaBaseline({
      env,
      runNeonCommand: (args) => {
        if (args[0] === "branches") return { status: 0, stdout: branchResponse };
        return {
          status: 0,
          stdout:
            args[1] === branchId
              ? "postgresql://ep-signed-check-pooler.us-east-1.aws.neon.tech/neondb"
              : connections[args[1] as keyof typeof connections],
        };
      },
      runPrismaCommand: (args) => ({ status: 0, stdout: args[1] === "status" ? appliedStatus : "" }),
      stderr: { write: (chunk: string) => (errorOutput += chunk) } as NodeJS.WriteStream,
    });
    expect(pooledExit).toBe(2);
    expect(errorOutput).toContain("Pooled Neon connections cannot be used");
  });

  it("rejects two Branch IDs that resolve to the same Direct database endpoint", () => {
    let prismaCalled = false;
    let errorOutput = "";
    const exitCode = verifyPrismaBaseline({
      env,
      runNeonCommand: (args) => {
        if (args[0] === "branches") return { status: 0, stdout: branchResponse };
        return { status: 0, stdout: connections[env.PRISMA_SIGNED_DATABASE_BRANCH_ID] };
      },
      runPrismaCommand: () => {
        prismaCalled = true;
        return { status: 0, stdout: appliedStatus };
      },
      stderr: {
        write: (chunk: string) => {
          errorOutput += chunk;
          return true;
        },
      } as NodeJS.WriteStream,
    });

    expect(exitCode).toBe(2);
    expect(prismaCalled).toBe(false);
    expect(errorOutput).toContain("resolve to the same database endpoint");
    expect(errorOutput).not.toContain("neon.tech");
  });

  it("hides raw Prisma errors when a verification command fails", () => {
    let errorOutput = "";
    const exitCode = verifyPrismaBaseline({
      env,
      runNeonCommand: (args) => {
        if (args[0] === "branches") return { status: 0, stdout: branchResponse };
        return { status: 0, stdout: connections[args[1] as keyof typeof connections] };
      },
      runPrismaCommand: () => ({ status: 4, stdout: "hidden-output", stderr: "hidden-connection-string" }),
      stderr: {
        write: (chunk: string) => {
          errorOutput += chunk;
          return true;
        },
      } as NodeJS.WriteStream,
    });

    expect(exitCode).toBe(1);
    expect(errorOutput).toContain("Prisma verify failed (exit 4)");
    expect(errorOutput).not.toContain("hidden");
  });

  it.each([
    {
      name: "diagnostics",
      output: JSON.stringify({
        kind: "result",
        envelope: {
          ok: true,
          diagnostics: [{ code: "MIGRATION.MARKER_NOT_IN_HISTORY" }],
          result: { ok: true, diagnostics: [], spaces: [{ migrations: [{ status: "applied" }] }] },
        },
      }),
    },
    {
      name: "pending",
      output: JSON.stringify({
        kind: "result",
        envelope: {
          ok: true,
          diagnostics: [],
          result: { ok: true, diagnostics: [], spaces: [{ migrations: [{ status: "pending" }] }] },
        },
      }),
    },
    { name: "invalid JSON", output: "not-json" },
    { name: "missing result", output: JSON.stringify({ kind: "result", envelope: { ok: true, diagnostics: [] } }) },
  ])("fails closed when migration status contains $name", ({ output: statusOutput }) => {
    const result = runWithStatus(statusOutput);

    expect(result.exitCode).toBe(1);
    expect(result.output).toBe("");
    expect(result.errorOutput).toMatch(/migration status|pending/i);
    expect(result.errorOutput).not.toContain("MIGRATION.MARKER_NOT_IN_HISTORY");
    expect(result.errorOutput).not.toContain("neon.tech");
  });
});
