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
    if (args[0] === "api") {
      return JSON.stringify({ branches: [{ id: "br-current", name: branchName }] });
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
    expect(runCli.mock.calls[0][0]).toContain("/projects/test-project/branches");
    expect(runCli.mock.calls[1][0]).toEqual(["connection-string", "br-current", "--project-id", "test-project"]);
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
    ).rejects.toThrow("Neon branch configured for preview was not found");
  });

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
    expect(() => assertDirectConnection("not-a-uri")).toThrow("Neon returned an invalid connection URI.");
    expect(() => assertDirectConnection("https://localhost/path")).toThrow("Neon returned an invalid connection URI.");
  });

  it("requires a known target and config values", async () => {
    await expect(resolveNeonTarget("testing")).rejects.toThrow("--target must be preview or production");
    await expect(resolveNeonTarget("preview", { readConfig: vi.fn(async () => "{}") })).rejects.toThrow(
      "must define projectId and preview.branchName",
    );
  });
});
