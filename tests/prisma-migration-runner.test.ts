import { describe, expect, it, vi } from "vitest";
import { parsePrismaMigrationArguments, runPrismaMigration } from "../scripts/run-prisma-migration.mjs";

const successfulApply = JSON.stringify({
  kind: "result",
  envelope: {
    ok: true,
    exitCode: 0,
    diagnostics: [],
    result: { ok: true, migrationsApplied: 1, migrationsTotal: 1 },
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
});
