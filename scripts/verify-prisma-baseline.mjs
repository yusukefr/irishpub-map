import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertDirectConnection } from "./lib/resolve-neon-target.mjs";

const neonConfig = JSON.parse(readFileSync(resolve("config/neon-targets.json"), "utf8"));
const projectId = neonConfig.projectId;
const forbiddenBranchNames = new Set([neonConfig.targets.production.branchName, neonConfig.targets.preview.branchName]);
const prismaConfigPath = "config/prisma-baseline-verify.config.ts";
const databaseTargets = [
  { name: "signed verification branch", variable: "PRISMA_SIGNED_DATABASE_BRANCH_ID" },
  { name: "empty baseline branch", variable: "PRISMA_EMPTY_DATABASE_BRANCH_ID" },
];

function validateBranchId(value, variable) {
  if (!value) throw new Error(`${variable} is required.`);
  if (!/^br-[a-z0-9-]+$/i.test(value)) throw new Error(`${variable} must be a Neon Branch ID.`);
  return value;
}

function runNeon(args) {
  return spawnSync("npm", ["exec", "--", "neon", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function runPrisma(args, databaseUrl, spawn = spawnSync) {
  return spawn("npm", ["exec", "--", "prisma", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PRISMA_BASELINE_VERIFY_DATABASE_URL: databaseUrl },
  });
}

function parseJsonOutput(stdout) {
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length !== 1) throw new Error("Unexpected Prisma JSON output.");
  return JSON.parse(lines[0]);
}

function assertMigrationStatus(stdout) {
  let output;
  try {
    output = parseJsonOutput(stdout);
  } catch {
    throw new Error("Prisma migration status returned invalid JSON.");
  }
  const envelope = output?.kind === "result" ? output.envelope : undefined;
  const result = envelope?.result;
  if (
    envelope?.ok !== true ||
    !Array.isArray(envelope.diagnostics) ||
    envelope.diagnostics.length > 0 ||
    result?.ok !== true ||
    !Array.isArray(result.diagnostics) ||
    result.diagnostics.length > 0
  ) {
    throw new Error("Prisma migration status reported diagnostics.");
  }

  const spaces = result.spaces;
  if (!Array.isArray(spaces) || spaces.length === 0)
    throw new Error("Prisma migration status omitted contract spaces.");

  let migrationCount = 0;
  let appliedCount = 0;
  for (const space of spaces) {
    if (!Array.isArray(space.migrations)) throw new Error("Prisma migration status omitted migrations.");
    for (const migration of space.migrations) {
      migrationCount += 1;
      if (migration.status === "pending") throw new Error("Prisma migration status includes pending migrations.");
      if (migration.status === "applied") appliedCount += 1;
      else if (migration.status !== null) throw new Error("Prisma migration status has an unknown migration state.");
    }
  }
  if (migrationCount === 0 || appliedCount === 0)
    throw new Error("Prisma migration status did not confirm an applied baseline.");
}

function parseNeonBranches(stdout) {
  try {
    const response = JSON.parse(stdout);
    const branches = Array.isArray(response) ? response : response?.branches;
    if (!Array.isArray(branches)) throw new Error("invalid branches");
    return branches;
  } catch {
    throw new Error("Neon CLI returned invalid branch data.");
  }
}

function resolveBranch(branches, branchId, target) {
  const branch = branches.find((entry) => entry.id === branchId);
  if (!branch) throw new Error(`${target.name}: Neon Branch ID was not found in the configured project.`);
  if (forbiddenBranchNames.has(branch.name)) {
    throw new Error(`${target.name}: the fixed Preview and Production branches cannot be used for verification.`);
  }
  if ((branch.current_state ?? branch.state) !== "ready") {
    throw new Error(`${target.name}: the Neon Branch is not ready.`);
  }
  return branch;
}

function resolveConnection(runNeonCli, branch, target) {
  const result = runNeonCli(["connection-string", branch.id, "--project-id", projectId]);
  if (result.error || result.status !== 0 || !result.stdout?.trim()) {
    throw new Error(`${target.name}: could not resolve the Neon connection.`);
  }

  const connection = result.stdout.trim();
  assertDirectConnection(connection);
  const url = new URL(connection);
  if (!url.hostname.endsWith(".neon.tech")) throw new Error(`${target.name}: connection is not a Neon endpoint.`);
  return { connection, identity: `${url.hostname.toLowerCase()}${url.port ? `:${url.port}` : ""}${url.pathname}` };
}

function resolveVerificationConnections({ env, runNeonCli }) {
  const branchIds = databaseTargets.map((target) => validateBranchId(env[target.variable], target.variable));
  if (branchIds[0] === branchIds[1]) throw new Error("Verification Branch IDs must be different.");

  const listResult = runNeonCli(["branches", "list", "--project-id", projectId, "--output", "json"]);
  if (listResult.error || listResult.status !== 0 || !listResult.stdout) {
    throw new Error("Neon CLI could not list the configured project's Branches.");
  }

  const branches = parseNeonBranches(listResult.stdout);
  const resolved = databaseTargets.map((target, index) => {
    const branch = resolveBranch(branches, branchIds[index], target);
    return { target, ...resolveConnection(runNeonCli, branch, target) };
  });
  if (resolved[0].identity === resolved[1].identity) {
    throw new Error("The signed verification and empty baseline Branches resolve to the same database endpoint.");
  }
  return resolved;
}

export function verifyPrismaBaseline({
  env = process.env,
  runPrismaCommand = runPrisma,
  runNeonCommand = runNeon,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  let resolvedTargets;
  try {
    resolvedTargets = resolveVerificationConnections({ env, runNeonCli: runNeonCommand });
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 2;
  }

  for (const { target, connection } of resolvedTargets) {
    const commands = [
      { name: "verify", args: ["db", "verify", "--json", "--config", prismaConfigPath] },
      { name: "status", args: ["migration", "status", "--space", "app", "--json", "--config", prismaConfigPath] },
    ];
    for (const command of commands) {
      const result = runPrismaCommand(command.args, connection);
      if (result.error || result.status !== 0) {
        const exitCode = result.status ?? 1;
        stderr.write(`${target.name}: Prisma ${command.name} failed (exit ${exitCode}).\n`);
        return 1;
      }
      if (command.name === "status") {
        try {
          assertMigrationStatus(result.stdout ?? "");
        } catch (error) {
          stderr.write(`${target.name}: ${error.message}\n`);
          return 1;
        }
      }
    }
    stdout.write(`${target.name}: schema and migration status verified.\n`);
  }

  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = verifyPrismaBaseline();
}
