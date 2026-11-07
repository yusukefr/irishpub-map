import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import {
  parseValidationArgs,
  resolveValidationConnection,
  runPrisma,
  runPrismaValidation,
  runValidationCommand,
  validateValidationBranch,
} from "../scripts/run-prisma-validation.mjs";

const branchId = "br-issue639-validation";
const branchName = "validation/issue-639/isolated";
const databaseUrl = "postgresql://ep-issue639.neon.tech/neondb";
const credentialUrl = new URL(databaseUrl);
credentialUrl.username = "validation";
credentialUrl.password = "p@ssword";
const decodedPassword = decodeURIComponent(credentialUrl.password);

function prismaResult(result: Record<string, unknown>, diagnostics: unknown[] = []) {
  return JSON.stringify({
    kind: "result",
    envelope: {
      ok: true,
      exitCode: 0,
      diagnostics,
      result: { ok: true, ...result },
    },
  });
}

const appliedStatus = prismaResult({
  diagnostics: [],
  summary: "Up to date",
  spaces: [
    {
      space: "app",
      currentContract: "contract-hash",
      targetContract: "contract-hash",
      migrations: [{ status: "applied" }],
    },
  ],
});

function runStatus(output: string) {
  let stdout = "";
  let stderr = "";
  const exitCode = runPrismaValidation({
    argv: ["--branch-id", branchId, "--confirm-data-free", branchId, "status"],
    runNeonCli: (args) =>
      args[0] === "branches"
        ? { status: 0, stdout: JSON.stringify({ branches: [makeBranch()] }) }
        : { status: 0, stdout: databaseUrl },
    runPrismaCli: () => ({ status: 0, stdout: output }),
    stdout: { write: (chunk: string) => (stdout += chunk) } as unknown as NodeJS.WriteStream,
    stderr: { write: (chunk: string) => (stderr += chunk) } as unknown as NodeJS.WriteStream,
  });
  return { exitCode, stdout, stderr };
}

function makeBranch(overrides: Record<string, unknown> = {}) {
  return {
    id: branchId,
    name: branchName,
    project_id: "purple-cake-39243248",
    current_state: "ready",
    primary: false,
    default: false,
    ...overrides,
  };
}

describe("Prisma validation runner argument and Branch guards", () => {
  it("requires the explicit Branch ID and data-free attestation", () => {
    expect(() => parseValidationArgs(["verify"])).toThrow(/--branch-id/);
    expect(() => parseValidationArgs(["--branch-id", branchId, "--confirm-data-free", "other", "verify"])).toThrow(
      /repeat the selected Branch ID/,
    );
    expect(parseValidationArgs(["--branch-id", branchId, "--confirm-data-free", branchId, "verify"])).toEqual({
      branchId,
      confirmation: branchId,
      command: "verify",
    });
  });

  it("rejects arbitrary Prisma flags and commands", () => {
    expect(() =>
      parseValidationArgs(["--branch-id", branchId, "--confirm-data-free", branchId, "--db", "url", "apply"]),
    ).toThrow(/Only --branch-id and --confirm-data-free/);
    expect(() => parseValidationArgs(["--branch-id", branchId, "--confirm-data-free", branchId, "db-push"])).toThrow(
      /supported command/,
    );
  });

  it("requires the Branch to belong to the configured project, be ready, and have the validation name prefix", () => {
    expect(validateValidationBranch([makeBranch()], branchId)).toEqual({ id: branchId, name: branchName });
    expect(() => validateValidationBranch([], branchId)).toThrow(/not found/);
    expect(() => validateValidationBranch([makeBranch({ project_id: "another-project" })], branchId)).toThrow(
      /not confirmed as part of the configured project/,
    );
    expect(() => validateValidationBranch([makeBranch({ current_state: "archived" })], branchId)).toThrow(/not ready/);
    expect(() => validateValidationBranch([makeBranch({ name: "preview" })], branchId)).toThrow(/fixed Preview/);
    expect(() => validateValidationBranch([makeBranch({ name: "preview/ai/other" })], branchId)).toThrow(
      /name must start/,
    );
    expect(() => validateValidationBranch([makeBranch({ primary: true })], branchId)).toThrow(/fixed Preview/);
  });
});

describe("Prisma validation runner secret handling", () => {
  it("resolves only a direct Neon endpoint for the verified Branch", () => {
    const calls: string[][] = [];
    const connection = resolveValidationConnection({ id: branchId, name: branchName }, (args) => {
      calls.push(args);
      return { status: 0, stdout: databaseUrl };
    });

    expect(connection).toBe(databaseUrl);
    expect(calls).toEqual([["connection-string", branchId, "--project-id", "purple-cake-39243248"]]);
    expect(() =>
      resolveValidationConnection({ id: branchId, name: branchName }, () => ({
        status: 0,
        stdout: databaseUrl.replace("ep-issue639.neon.tech", "ep-issue639-pooler.neon.tech"),
      })),
    ).toThrow(/Pooled Neon connections/);
    expect(() =>
      resolveValidationConnection({ id: branchId, name: branchName }, () => ({
        status: 0,
        stdout: "postgresql://not-neon.example/db",
      })),
    ).toThrow(/not a Neon endpoint/);
  });

  it("passes database URL only through the child environment", () => {
    let command = "";
    let args: string[] = [];
    let childEnv: NodeJS.ProcessEnv = {};
    const result = runPrisma(
      ["db", "verify", "--config", "config/temp.ts"],
      {
        PRISMA_VALIDATION_DATABASE_URL: databaseUrl,
      },
      (spawnCommand, spawnArgs, options) => {
        command = spawnCommand;
        args = spawnArgs;
        childEnv = options.env;
        return { status: 0 };
      },
    );

    expect(command).toBe("npm");
    expect(args).not.toContain(databaseUrl);
    expect(JSON.stringify(args)).not.toContain("ep-issue639.neon.tech");
    expect(childEnv.PRISMA_VALIDATION_DATABASE_URL).toBe(databaseUrl);
    expect(childEnv.DATABASE_URL).toBeUndefined();
    expect(childEnv.DIRECT_URL).toBeUndefined();
    expect(childEnv.CI).toBe("true");
    expect(result.status).toBe(0);
  });

  it.each([
    ["preview", ["db", "migrate", "--show", "--json"], { migrations: [] }],
    ["apply", ["db", "migrate", "--advance-ref", "db", "--json"], { migrationsApplied: 1, migrationsTotal: 1 }],
    ["verify", ["db", "verify", "--json"], {}],
    ["verifyStrict", ["db", "verify", "--schema-only", "--strict", "--json"], {}],
    [
      "status",
      ["migration", "status", "--space", "app", "--json"],
      {
        diagnostics: [],
        spaces: [
          {
            space: "app",
            currentContract: "contract-hash",
            targetContract: "contract-hash",
            migrations: [{ status: "applied" }],
          },
        ],
      },
    ],
    ["log", ["migration", "log", "--json"], {}],
  ] as const)("maps the %s mode to an allowlisted Prisma invocation", (mode, expectedArgs, cliResult) => {
    let configContents = "";
    let prismaArgs: string[] = [];
    let prismaEnv: NodeJS.ProcessEnv = {};
    const result = runValidationCommand(mode, databaseUrl, {
      writeConfig: (_path, contents) => {
        configContents = contents;
      },
      runPrismaCli: (args, env) => {
        prismaArgs = args;
        prismaEnv = env;
        return { status: 0, stdout: prismaResult(cliResult as Record<string, unknown>) };
      },
    });

    expect(prismaArgs.slice(0, expectedArgs.length)).toEqual(expectedArgs);
    expect(prismaArgs).toContain("--config");
    expect(prismaEnv.PRISMA_VALIDATION_DATABASE_URL).toBe(databaseUrl);
    expect(configContents).toContain("parent: false");
    expect(configContents).toContain("PRISMA_VALIDATION_DATABASE_URL");
    expect(configContents).not.toContain(databaseUrl);
    expect(result.failure).toBe(false);
    expect(result.summary).not.toContain("ep-issue639.neon.tech");
  });

  it("fails status when exit code is zero but Prisma reports a warning", () => {
    const output = prismaResult(
      {
        diagnostics: [],
        spaces: [
          {
            space: "app",
            currentContract: "contract-hash",
            targetContract: "contract-hash",
            migrations: [{ status: "applied" }],
          },
        ],
      },
      [{ code: "MIGRATION.MARKER_NOT_IN_HISTORY", severity: "warn" }],
    );
    const result = runStatus(output);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/diagnostics/);
  });

  it("fails status when diagnostics are attached to the result", () => {
    const output = prismaResult({
      diagnostics: [{ code: "MIGRATION.MARKER_NOT_IN_HISTORY", severity: "warn" }],
      spaces: [
        {
          space: "app",
          currentContract: "contract-hash",
          targetContract: "contract-hash",
          migrations: [{ status: "applied" }],
        },
      ],
    });
    const result = runStatus(output);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/unsuccessful result or diagnostics/);
  });

  it("fails status when exit code is zero but an app migration is pending", () => {
    const output = prismaResult({
      diagnostics: [],
      spaces: [
        {
          space: "app",
          currentContract: "previous-contract",
          targetContract: "contract-hash",
          migrations: [{ status: "applied" }, { status: "pending" }],
        },
      ],
    });
    const result = runStatus(output);
    expect(result.exitCode).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/not up to date|pending/);
  });

  it("fails closed when status output is malformed or has an unknown migration state", () => {
    expect(runStatus("not json").exitCode).not.toBe(0);
    const unknownState = prismaResult({
      diagnostics: [],
      spaces: [
        {
          space: "app",
          currentContract: "contract-hash",
          targetContract: "contract-hash",
          migrations: [{ status: "unknown" }],
        },
      ],
    });
    expect(runStatus(unknownState).exitCode).not.toBe(0);
  });

  it("accepts structured progress events but requires exactly one result record", () => {
    const output = [
      JSON.stringify({ kind: "step-started", step: "Verifying database marker" }),
      JSON.stringify({ kind: "step-finished", step: "Verifying database marker", outcome: "ok" }),
      prismaResult({ summary: "Database marker and schema match contract" }),
    ].join("\n");
    const result = runValidationCommand("verify", databaseUrl, {
      writeConfig: () => {},
      runPrismaCli: () => ({ status: 0, stdout: output }),
    });
    expect(result.failure).toBe(false);
    expect(result.summary).toBe("Database marker and schema match the contract.");
  });

  it("never prints raw CLI output containing the database URL or decoded password", () => {
    let stdout = "";
    let stderr = "";
    const exitCode = runPrismaValidation({
      argv: ["--branch-id", branchId, "--confirm-data-free", branchId, "verify"],
      runNeonCli: (args) =>
        args[0] === "branches"
          ? { status: 0, stdout: JSON.stringify({ branches: [makeBranch()] }) }
          : { status: 0, stdout: credentialUrl.toString() },
      runPrismaCli: () => ({
        status: 1,
        stdout: `failed for ${credentialUrl.toString()}`,
        stderr: `password=${decodedPassword}`,
      }),
      stdout: { write: (chunk: string) => (stdout += chunk) } as unknown as NodeJS.WriteStream,
      stderr: { write: (chunk: string) => (stderr += chunk) } as unknown as NodeJS.WriteStream,
    });

    expect(exitCode).not.toBe(0);
    expect(stdout).toBe("");
    expect(stderr).toContain("Prisma verify failed");
    expect(stderr).not.toContain(credentialUrl.toString());
    expect(stderr).not.toContain(decodedPassword);
  });

  it("does not invoke Prisma before validating the Branch identity", () => {
    let prismaCalls = 0;
    let errorOutput = "";
    const exitCode = runPrismaValidation({
      argv: ["--branch-id", branchId, "--confirm-data-free", branchId, "apply"],
      runNeonCli: () => ({ status: 0, stdout: JSON.stringify({ branches: [makeBranch({ name: "main" })] }) }),
      runPrismaCli: () => {
        prismaCalls += 1;
        return { status: 0 };
      },
      stdout: { write: () => true } as unknown as NodeJS.WriteStream,
      stderr: {
        write: (chunk: string) => {
          errorOutput += chunk;
          return true;
        },
      } as unknown as NodeJS.WriteStream,
    });

    expect(exitCode).toBe(2);
    expect(prismaCalls).toBe(0);
    expect(errorOutput).toMatch(/fixed Preview/);
    expect(errorOutput).not.toContain("ep-issue639.neon.tech");
  });

  it("validates the selected Branch before Prisma and removes the transient config", () => {
    const neonCalls: string[][] = [];
    let prismaArgs: string[] = [];
    let prismaEnv: NodeJS.ProcessEnv = {};
    let output = "";
    let errorOutput = "";
    const exitCode = runPrismaValidation({
      argv: ["--branch-id", branchId, "--confirm-data-free", branchId, "preview"],
      runNeonCli: (args) => {
        neonCalls.push(args);
        if (args[0] === "branches") return { status: 0, stdout: JSON.stringify({ branches: [makeBranch()] }) };
        return { status: 0, stdout: databaseUrl };
      },
      runPrismaCli: (args, env) => {
        prismaArgs = args;
        prismaEnv = env;
        return { status: 0, stdout: prismaResult({ migrations: [] }), stderr: `warning ${databaseUrl}` };
      },
      stdout: {
        write: (chunk: string) => {
          output += chunk;
          return true;
        },
      } as unknown as NodeJS.WriteStream,
      stderr: {
        write: (chunk: string) => {
          errorOutput += chunk;
          return true;
        },
      } as unknown as NodeJS.WriteStream,
    });

    const configIndex = prismaArgs.indexOf("--config");
    const configPath = prismaArgs[configIndex + 1];
    expect(exitCode).toBe(0);
    expect(neonCalls[0]).toEqual(["branches", "list", "--project-id", "purple-cake-39243248", "--output", "json"]);
    expect(neonCalls[1]).toEqual(["connection-string", branchId, "--project-id", "purple-cake-39243248"]);
    expect(prismaArgs).not.toContain(databaseUrl);
    expect(prismaEnv.PRISMA_VALIDATION_DATABASE_URL).toBe(databaseUrl);
    expect(output).toContain(`validated Branch ID ${branchId}`);
    expect(output).toContain("Preview reports 0 migration(s)");
    expect(output).not.toContain("ep-issue639.neon.tech");
    expect(errorOutput).toBe("");
    expect(existsSync(dirname(configPath))).toBe(false);
  });
});
