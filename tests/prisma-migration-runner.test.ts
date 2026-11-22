import { describe, expect, it, vi } from "vitest";
import {
  parsePrismaMigrationArguments,
  PRISMA_COMMAND_ARGUMENTS,
  runPrismaMigration,
  summarizeResult,
} from "../scripts/run-prisma-migration.mjs";

const successfulApply = JSON.stringify({
  kind: "result",
  envelope: {
    ok: true,
    exitCode: 0,
    diagnostics: [],
    result: { ok: true, migrationsApplied: 1, migrationsTotal: 1 },
  },
});

const statusResult = ({ currentContract = "a".repeat(64), targetContract = "a".repeat(64), migrations = [] } = {}) =>
  JSON.stringify({
    kind: "result",
    envelope: {
      ok: true,
      exitCode: 0,
      diagnostics: [],
      result: {
        ok: true,
        spaces: [{ space: "app", currentContract, targetContract, migrations }],
      },
    },
  });

describe("Prisma migration runner target and consent guards", () => {
  it("accepts only the supported targets and operations", () => {
    expect(parsePrismaMigrationArguments(["--target", "preview", "preview"])).toEqual({
      target: "preview",
      command: "preview",
      productionConfirmation: undefined,
    });
    expect(() => parsePrismaMigrationArguments(["--target", "staging", "status"])).toThrow("Usage:");
    expect(() => parsePrismaMigrationArguments(["--target", "preview", "db", "update"])).toThrow(
      "Select exactly one Prisma operation.",
    );
  });

  it("requires a per-operation confirmation for Production apply", () => {
    expect(() => parsePrismaMigrationArguments(["--target", "production", "apply"])).toThrow(
      "Production apply requires --confirm-production",
    );
    expect(
      parsePrismaMigrationArguments(["--target", "production", "--confirm-production", "main", "apply"]),
    ).toMatchObject({ target: "production", command: "apply", productionConfirmation: "main" });
  });

  it("fails closed if Production confirmation does not match the resolved branch", async () => {
    const execute = vi.fn();
    await expect(
      runPrismaMigration(["--target", "production", "--confirm-production", "wrong-branch", "apply"], {
        resolveTarget: async () => ({
          target: "production",
          branchName: "main",
          connectionString: "postgresql://ep.example.neon.tech/db",
        }),
        execute,
      }),
    ).rejects.toThrow("Production confirmation must exactly match");
    expect(execute).not.toHaveBeenCalled();
  });

  it("runs one allowlisted apply after exact Production confirmation", async () => {
    const execute = vi.fn(() => ({ status: 0, stdout: successfulApply }));
    await runPrismaMigration(["--target", "production", "--confirm-production", "main", "apply"], {
      resolveTarget: async () => ({
        target: "production",
        branchName: "main",
        connectionString: "postgresql://ep.example.neon.tech/db",
      }),
      execute,
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[0]).toBe("apply");
  });

  it("allows Production read-only operations without an apply confirmation", async () => {
    const results = {
      preview: JSON.stringify({
        kind: "result",
        envelope: { ok: true, exitCode: 0, diagnostics: [], result: { ok: true, migrations: [] } },
      }),
      verify: JSON.stringify({
        kind: "result",
        envelope: { ok: true, exitCode: 0, diagnostics: [], result: { ok: true } },
      }),
      status: statusResult(),
      log: JSON.stringify({
        kind: "result",
        envelope: { ok: true, exitCode: 0, diagnostics: [], result: { ok: true } },
      }),
    };
    for (const command of ["preview", "verify", "status", "log"] as const) {
      const execute = vi.fn(() => ({ status: 0, stdout: results[command] }));
      await runPrismaMigration(["--target", "production", command], {
        resolveTarget: async () => ({
          target: "production",
          branchName: "main",
          connectionString: "postgresql://ep.example.neon.tech/db",
        }),
        execute,
      });
      expect(execute).toHaveBeenCalledWith(command, "postgresql://ep.example.neon.tech/db");
    }
  });

  it("fails status when Prisma exits successfully with pending migrations", () => {
    expect(() => summarizeResult("status", statusResult({ migrations: [{ status: "pending" }] }))).toThrow(
      /current [a-f0-9]{64}, target [a-f0-9]{64}, 1 pending migration/,
    );
  });

  it("fails status when the app contract marker differs from the target", () => {
    expect(() => summarizeResult("status", statusResult({ targetContract: "b".repeat(64) }))).toThrow(
      /current [a-f0-9]{64}, target [a-f0-9]{64}, 0 pending migration/,
    );
  });

  it("fails status on unknown migration state or CLI diagnostics", () => {
    expect(() => summarizeResult("status", statusResult({ migrations: [{ status: "unknown" }] }))).toThrow(
      "unknown migration state",
    );
    const diagnostic = JSON.stringify({
      kind: "result",
      envelope: { ok: true, exitCode: 0, diagnostics: [{ message: "drift" }], result: { ok: true } },
    });
    expect(() => summarizeResult("status", diagnostic)).toThrow("diagnostics");
  });

  it("verifies both the Prisma marker and schema", async () => {
    expect(PRISMA_COMMAND_ARGUMENTS.verify).toEqual(["db", "verify", "--json"]);
    const output = JSON.stringify({
      kind: "result",
      envelope: {
        ok: true,
        exitCode: 0,
        diagnostics: [],
        result: { ok: true, summary: "untrusted Prisma text" },
      },
    });
    expect(summarizeResult("verify", output)).toBe("The database contract marker and schema match.");
    await expect(
      runPrismaMigration(["--target", "preview", "verify"], {
        resolveTarget: async () => ({
          target: "preview",
          branchName: "preview",
          connectionString: "postgresql://ep.example.neon.tech/db",
        }),
        execute: vi.fn(() => ({ status: 4, stdout: "", stderr: "Contract marker mismatch" })),
      }),
    ).rejects.toThrow("Prisma verify failed");
  });

  it("never forwards free-form Prisma summaries", () => {
    const output = JSON.stringify({
      kind: "result",
      envelope: {
        ok: true,
        exitCode: 0,
        diagnostics: [],
        result: { ok: true, migrations: [], summary: "untrusted Prisma text" },
      },
    });
    expect(summarizeResult("preview", output)).toBe("Preview contains 0 migration(s); review before apply.");
  });
});
