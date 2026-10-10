import { describe, expect, it, vi } from "vitest";
import { assertDirectConnection, resolveNeonTarget } from "../scripts/lib/resolve-neon-target.mjs";

const config = {
  projectId: "test-project",
  targets: {
    preview: { branchName: "preview" },
    production: { branchName: "main" },
  },
};

function cliFor(branchName = "preview", connectionString = "postgres://test-user@ep-direct/neondb") {
  return vi.fn(async (args: string[]) => {
    if (args[0] === "branches") {
      const branches = Array.from({ length: 30 }, (_, index) => ({
        id: `br-earlier-${index}`,
        name: `earlier-branch-${index}`,
        current_state: "ready",
      }));
      branches.push({ id: "br-current", name: branchName, current_state: "ready" });
      return JSON.stringify(branches);
    }
    return connectionString;
  });
}

describe("resolveNeonTarget", () => {
  it.each(["preview", "production"])("resolves the configured %s Branch at runtime", async (target) => {
    const runCli = cliFor(target === "preview" ? "preview" : "main");
    const resolved = await resolveNeonTarget(target, {
      readConfig: vi.fn(async () => JSON.stringify(config)),
      runCli,
      cwd: "/workspace",
    });

    expect(resolved).toMatchObject({
      target,
      projectId: "test-project",
      branchId: "br-current",
      connectionString: "postgres://test-user@ep-direct/neondb",
    });
    expect(runCli).toHaveBeenCalledTimes(2);
    expect(runCli.mock.calls[0][0]).toEqual(["branches", "list", "--project-id", "test-project", "--output", "json"]);
    expect(runCli.mock.calls[1][0]).toEqual(["connection-string", "br-current", "--project-id", "test-project"]);
  });

  it("resolves with a project-scoped API key when the Branch API allows access", async () => {
    const runCli = cliFor();
    await expect(
      resolveNeonTarget("preview", {
        readConfig: vi.fn(async () => JSON.stringify(config)),
        runCli,
      }),
    ).resolves.toMatchObject({ branchName: "preview" });
    expect(runCli.mock.calls[0][0][0]).toBe("branches");
  });

  it("does not need worktree env files", async () => {
    await expect(
      resolveNeonTarget("preview", {
        readConfig: vi.fn(async (path) => {
          expect(path).toBe("/workspace/config/neon-targets.json");
          return JSON.stringify(config);
        }),
        runCli: cliFor(),
        cwd: "/workspace",
      }),
    ).resolves.toMatchObject({ branchName: "preview" });
  });

  it("stops when the configured branch is missing", async () => {
    await expect(
      resolveNeonTarget("preview", {
        readConfig: vi.fn(async () => JSON.stringify(config)),
        runCli: cliFor("main"),
      }),
    ).rejects.toThrow("NEON_BRANCH_NOT_FOUND: Neon branch configured for preview was not found");
  });

  it.each(["archived", "init", undefined])("stops unless the branch is ready (%s)", async (current_state) => {
    const runCli = vi.fn(async (args: string[]) => {
      if (args[0] === "branches") return JSON.stringify([{ id: "br-current", name: "preview", current_state }]);
      return "postgres://test-user@ep-direct/neondb";
    });
    await expect(
      resolveNeonTarget("preview", { readConfig: vi.fn(async () => JSON.stringify(config)), runCli }),
    ).rejects.toThrow(`NEON_BRANCH_NOT_READY: Neon branch preview (br-current) is ${current_state ?? "unknown"}`);
    expect(runCli).toHaveBeenCalledTimes(1);
  });

  it("distinguishes missing CLI and unavailable authentication without exposing CLI output", async () => {
    const missingCli = Object.assign(new Error("spawn neon ENOENT"), { code: "ENOENT" });
    await expect(
      resolveNeonTarget("preview", {
        readConfig: vi.fn(async () => JSON.stringify(config)),
        runCli: vi.fn(async () => {
          throw missingCli;
        }),
      }),
    ).rejects.toThrow("NEON_CLI_NOT_INSTALLED:");

    const secret = "napi_secret-value";
    await expect(
      resolveNeonTarget("preview", {
        readConfig: vi.fn(async () => JSON.stringify(config)),
        runCli: vi.fn(async () => {
          throw new Error(`Not signed in; ${secret}`);
        }),
      }),
    ).rejects.toThrow("NEON_AUTH_UNAVAILABLE:");
    await expect(
      resolveNeonTarget("preview", {
        readConfig: vi.fn(async () => JSON.stringify(config)),
        runCli: vi.fn(async () => {
          throw new Error(`Not signed in; ${secret}`);
        }),
      }),
    ).rejects.not.toThrow(secret);
  });

  it.each(["403 Forbidden: project access denied", "404 Not Found"])(
    "distinguishes project access denial from missing authentication (%s)",
    async (message) => {
      await expect(
        resolveNeonTarget("preview", {
          readConfig: vi.fn(async () => JSON.stringify(config)),
          runCli: vi.fn(async () => {
            throw new Error(message);
          }),
        }),
      ).rejects.toThrow("NEON_PROJECT_ACCESS_DENIED:");

      await expect(
        resolveNeonTarget("preview", {
          readConfig: vi.fn(async () => JSON.stringify(config)),
          runCli: vi.fn(async () => {
            throw new Error("Cannot run interactive auth in CI");
          }),
        }),
      ).rejects.toThrow("NEON_AUTH_UNAVAILABLE:");
    },
  );

  it("rejects a pooled endpoint without exposing the connection string", async () => {
    const secret = "postgres://test-user@ep-direct-pooler/neondb";
    await expect(
      resolveNeonTarget("preview", {
        readConfig: vi.fn(async () => JSON.stringify(config)),
        runCli: cliFor("preview", secret),
      }),
    ).rejects.toThrow("Pooled Neon connections cannot be used for migrations.");
  });

  it("rejects malformed connection URIs", () => {
    expect(() => assertDirectConnection("not-a-uri")).toThrow(
      "NEON_CONNECTION_FAILED: Neon returned an invalid connection URI.",
    );
    expect(() => assertDirectConnection("https://localhost/path")).toThrow(
      "NEON_CONNECTION_FAILED: Neon returned an invalid connection URI.",
    );
  });

  it("requires a known target and config values", async () => {
    await expect(resolveNeonTarget("testing")).rejects.toThrow("--target must be preview or production");
    await expect(resolveNeonTarget("preview", { readConfig: vi.fn(async () => "{}") })).rejects.toThrow(
      "must define projectId and preview.branchName",
    );
  });
});
