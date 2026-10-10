import { describe, expect, it, vi } from "vitest";
import {
  getRequiredMigrationVersions,
  parsePreflightArguments,
  runNeonPreflight,
} from "../scripts/check-neon-preflight.mjs";

const resolvedTarget = {
  target: "preview",
  projectId: "test-project",
  branchName: "preview",
  branchId: "br-preview",
  branchState: "ready",
  connectionString: "postgres://user@ep-direct/db",
};

describe("parsePreflightArguments", () => {
  it("requires an explicit target and migration", () => {
    expect(parsePreflightArguments(["--target", "preview", "--required-migration", "024_add_pub_types"])).toEqual({
      target: "preview",
      requiredMigration: "024_add_pub_types",
    });
    expect(() => parsePreflightArguments(["--target", "production"])).toThrow("Usage:");
    expect(() => parsePreflightArguments(["--target", "main", "--required-migration", "024_add_pub_types"])).toThrow(
      "--target must be preview or production",
    );
  });
});

describe("getRequiredMigrationVersions", () => {
  it("selects known repository migrations before the requested version", async () => {
    const versions = await getRequiredMigrationVersions("024_add_pub_types", {
      readDirectory: vi.fn(async () => [
        "023_remove_resource_uuid_defaults_up.sql",
        "024_add_pub_types_up.sql",
        "001_legacy_up.sql",
        "025_future_up.sql",
        "024_add_pub_types_verify.sql",
      ]),
      cwd: "/workspace",
    });
    expect(versions).toEqual(["023_remove_resource_uuid_defaults"]);
  });

  it("rejects an unknown migration", async () => {
    await expect(
      getRequiredMigrationVersions("999_unknown", {
        readDirectory: vi.fn(async () => ["024_add_pub_types_up.sql"]),
      }),
    ).rejects.toThrow("Unknown repository migration");
  });
});

describe("runNeonPreflight", () => {
  function clientFor(versions: string[]) {
    const query = vi.fn(async (sql: string) => {
      if (sql === "SELECT version FROM schema_migrations") return { rows: versions.map((version) => ({ version })) };
      return { rows: [] };
    });
    return {
      connect: vi.fn(async () => {}),
      query,
      end: vi.fn(async () => {}),
      client: { connect: vi.fn(async () => {}), query, end: vi.fn(async () => {}) },
    };
  }

  it("checks branch migration history in a read-only transaction", async () => {
    const mock = clientFor(["023_remove_resource_uuid_defaults"]);
    const readDirectory = vi.fn(async () => ["023_remove_resource_uuid_defaults_up.sql", "024_add_pub_types_up.sql"]);
    const logger = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(
      runNeonPreflight(
        { target: "preview", requiredMigration: "024_add_pub_types" },
        {
          resolveTarget: vi.fn(async () => resolvedTarget),
          readDirectory,
          createClient: vi.fn(() => mock.client),
          cwd: "/workspace",
        },
      ),
    ).resolves.toBeUndefined();
    expect(mock.query.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN READ ONLY",
      "SELECT version FROM schema_migrations",
      "ROLLBACK",
    ]);
    expect(mock.client.end).toHaveBeenCalledOnce();
    logger.mockRestore();
  });

  it("allows the target migration itself to be unapplied", async () => {
    const mock = clientFor(["023_remove_resource_uuid_defaults"]);
    const logger = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(
      runNeonPreflight(
        { target: "preview", requiredMigration: "024_add_pub_types" },
        {
          resolveTarget: vi.fn(async () => resolvedTarget),
          readDirectory: vi.fn(async () => ["023_remove_resource_uuid_defaults_up.sql", "024_add_pub_types_up.sql"]),
          createClient: vi.fn(() => mock.client),
        },
      ),
    ).resolves.toBeUndefined();
    logger.mockRestore();
  });

  it("reports missing prior migrations before any write can occur", async () => {
    const mock = clientFor(["024_add_pub_types"]);
    await expect(
      runNeonPreflight(
        { target: "preview", requiredMigration: "024_add_pub_types" },
        {
          resolveTarget: vi.fn(async () => resolvedTarget),
          readDirectory: vi.fn(async () => ["023_remove_resource_uuid_defaults_up.sql", "024_add_pub_types_up.sql"]),
          createClient: vi.fn(() => mock.client),
        },
      ),
    ).rejects.toThrow(
      "MIGRATION_PREREQUISITE_MISSING: preview is missing migrations required before 024_add_pub_types: 023_remove_resource_uuid_defaults",
    );
    expect(mock.query).toHaveBeenCalledWith("BEGIN READ ONLY");
    expect(mock.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mock.client.end).toHaveBeenCalledOnce();
  });

  it("reports connection failure without leaking database errors", async () => {
    const logger = vi.spyOn(console, "log").mockImplementation(() => {});
    const client = {
      connect: vi.fn(async () => {
        throw new Error("postgres://secret-password");
      }),
      query: vi.fn(async () => ({ rows: [] })),
      end: vi.fn(async () => {}),
    };
    await expect(
      runNeonPreflight(
        { target: "preview", requiredMigration: "024_add_pub_types" },
        {
          resolveTarget: vi.fn(async () => resolvedTarget),
          readDirectory: vi.fn(async () => ["024_add_pub_types_up.sql"]),
          createClient: vi.fn(() => client),
        },
      ),
    ).rejects.toThrow("NEON_CONNECTION_FAILED: Could not read migration history from preview (br-preview).");
    await expect(
      runNeonPreflight(
        { target: "preview", requiredMigration: "024_add_pub_types" },
        {
          resolveTarget: vi.fn(async () => resolvedTarget),
          readDirectory: vi.fn(async () => ["024_add_pub_types_up.sql"]),
          createClient: vi.fn(() => client),
        },
      ),
    ).rejects.not.toThrow("secret-password");
    logger.mockRestore();
  });
});
