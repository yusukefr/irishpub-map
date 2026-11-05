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
    expect(result.status).toBe(0);
  });

  it.each([
    ["preview", ["db", "migrate", "--show"]],
    ["apply", ["db", "migrate", "--advance-ref", "db"]],
    ["verify", ["db", "verify"]],
    ["verifyStrict", ["db", "verify", "--schema-only", "--strict"]],
    ["status", ["migration", "status"]],
    ["log", ["migration", "log"]],
  ] as const)("maps the %s mode to an allowlisted Prisma invocation", (mode, expectedArgs) => {
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
        return { status: 0, stdout: `ran ${mode}` };
      },
    });

    expect(prismaArgs.slice(0, expectedArgs.length)).toEqual(expectedArgs);
    expect(prismaArgs).toContain("--config");
    expect(prismaEnv).toEqual({ PRISMA_VALIDATION_DATABASE_URL: databaseUrl });
    expect(configContents).toContain("parent: false");
    expect(configContents).toContain("PRISMA_VALIDATION_DATABASE_URL");
    expect(configContents).not.toContain(databaseUrl);
    expect(result.stdout).toBe(`ran ${mode}`);
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
        return { status: 0, stdout: `previewed ${databaseUrl}` };
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
    expect(output).toContain(`validated Branch ${branchName} (${branchId})`);
    expect(output).toContain("[REDACTED DATABASE URL]");
    expect(output).not.toContain("ep-issue639.neon.tech");
    expect(errorOutput).toBe("");
    expect(existsSync(dirname(configPath))).toBe(false);
  });
});
