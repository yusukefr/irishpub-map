import { randomBytes } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { assertDirectConnection, resolveNeonTarget } from "./lib/resolve-neon-target.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PRISMA_COMMAND_ARGUMENTS = {
  preview: ["db", "migrate", "--show", "--json"],
  apply: ["db", "migrate", "--advance-ref", "db", "--json"],
  verify: ["db", "verify", "--json"],
  status: ["migration", "status", "--space", "app", "--json"],
  log: ["migration", "log", "--json"],
};

/** Parses the supported Prisma operation and requires per-operation Production confirmation. */
export function parsePrismaMigrationArguments(args) {
  let target;
  let command;
  let productionConfirmation;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--target") {
      if (target) throw new Error("--target may be specified only once.");
      target = args[++index];
    } else if (value === "--confirm-production") {
      if (productionConfirmation) throw new Error("--confirm-production may be specified only once.");
      productionConfirmation = args[++index];
    } else if (value.startsWith("--")) throw new Error(`Unsupported option: ${value}`);
    else if (command) throw new Error("Select exactly one Prisma operation.");
    else command = value;
  }
  if (!target || !["preview", "production"].includes(target) || !Object.hasOwn(PRISMA_COMMAND_ARGUMENTS, command)) {
    throw new Error(
      "Usage: npm run prisma:migration:run -- --target preview|production [--confirm-production <branch-name>] preview|apply|verify|status|log",
    );
  }
  if (target === "production" && command === "apply" && !productionConfirmation) {
    throw new Error(
      "Production apply requires --confirm-production <configured-production-branch-name> after state and PR review.",
    );
  }
  if (target !== "production" && productionConfirmation) {
    throw new Error("--confirm-production is only valid for production.");
  }
  return { target, command, productionConfirmation };
}

/** Resolves the configured Neon target, then runs one allowlisted Prisma operation without printing credentials. */
export async function runPrismaMigration(args = process.argv.slice(2), dependencies = {}) {
  const parsed = parsePrismaMigrationArguments(args);
  const resolveTarget = dependencies.resolveTarget ?? resolveNeonTarget;
  const execute = dependencies.execute ?? executePrisma;
  const resolved = await resolveTarget(parsed.target);
  if (
    parsed.target === "production" &&
    parsed.command === "apply" &&
    parsed.productionConfirmation !== resolved.branchName
  ) {
    throw new Error("Production confirmation must exactly match the configured Production branch name.");
  }
  assertDirectConnection(resolved.connectionString);
  const result = execute(parsed.command, resolved.connectionString);
  if (result.status !== 0 || result.error)
    throw new Error(
      `Prisma ${parsed.command} failed for ${parsed.target}; inspect the selected target and migration package.`,
    );
  const summary = summarizeResult(parsed.command, result.stdout ?? "");
  process.stdout.write(
    `Prisma ${parsed.command} completed for ${resolved.target} (${resolved.branchName}). ${summary}\n`,
  );
  return 0;
}

function executePrisma(command, connectionString) {
  const token = randomBytes(8).toString("hex");
  const configDirectory = resolve(repositoryRoot, "config", `.prisma-migration-${token}`);
  const configPath = resolve(configDirectory, "prisma.config.ts");
  const config = `import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";
import { definePrismaConfig } from "prisma/config";

export default definePrismaConfig({
  parent: false,
  orm: definePostgresConfig({
    contract: "../../db/prisma/contract.prisma",
    output: "../../generated/prisma8",
    migrations: { dir: "../../migrations" },
    db: { connection: process.env.PRISMA_MIGRATION_DATABASE_URL },
  }),
});
`;
  mkdirSync(configDirectory, { mode: 0o700 });
  try {
    writeFileSync(configPath, config, { flag: "wx", mode: 0o600 });
    const env = { ...process.env, PRISMA_MIGRATION_DATABASE_URL: connectionString, CI: "true" };
    delete env.NEON_API_KEY;
    delete env.DATABASE_URL;
    delete env.DIRECT_URL;
    delete env.PRISMA_VALIDATION_DATABASE_URL;
    delete env.PRISMA_BASELINE_VERIFY_DATABASE_URL;
    return spawnSync(
      "npm",
      ["exec", "--no", "--", "prisma", ...PRISMA_COMMAND_ARGUMENTS[command], "--config", configPath],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } finally {
    rmSync(configDirectory, { recursive: true, force: true });
  }
}

export function summarizeResult(command, stdout) {
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  let messages;
  try {
    messages = lines.map((line) => JSON.parse(line));
  } catch {
    throw new Error("Prisma returned an invalid JSON result; no success was recorded.");
  }
  if (messages.some((message) => !["result", "step-started", "step-finished"].includes(message?.kind))) {
    throw new Error("Prisma returned an unexpected result; no success was recorded.");
  }
  const results = messages.filter((message) => message.kind === "result");
  const envelope = results[0]?.envelope;
  const result = envelope?.result;
  if (
    results.length !== 1 ||
    envelope?.ok !== true ||
    envelope.exitCode !== 0 ||
    !Array.isArray(envelope.diagnostics) ||
    envelope.diagnostics.length > 0 ||
    result?.ok !== true ||
    (result.diagnostics !== undefined && (!Array.isArray(result.diagnostics) || result.diagnostics.length > 0))
  ) {
    throw new Error("Prisma reported diagnostics or an unsuccessful operation; no success was recorded.");
  }
  if (command === "apply") {
    if (
      !Number.isInteger(result.migrationsApplied) ||
      !Number.isInteger(result.migrationsTotal) ||
      result.migrationsApplied !== result.migrationsTotal
    ) {
      throw new Error("Prisma did not confirm that all planned migrations were applied.");
    }
    return `Applied ${result.migrationsApplied} of ${result.migrationsTotal} migration(s).`;
  }
  if (command === "preview") {
    if (!Array.isArray(result.migrations)) throw new Error("Prisma preview omitted migration data.");
    return `Preview contains ${result.migrations.length} migration(s); review before apply.`;
  }
  if (command === "status") {
    if (!Array.isArray(result.spaces) || result.spaces.length !== 1 || result.spaces[0]?.space !== "app") {
      throw new Error("Prisma status omitted the app contract space.");
    }
    const space = result.spaces[0];
    if (
      !isContractHash(space.currentContract) ||
      !isContractHash(space.targetContract) ||
      !Array.isArray(space.migrations)
    ) {
      throw new Error("Prisma status omitted the current or target contract state.");
    }
    let pending = 0;
    for (const migration of space.migrations) {
      if (migration.status === "pending") pending += 1;
      else if (migration.status !== "applied" && migration.status !== null) {
        throw new Error("Prisma status returned an unknown migration state.");
      }
    }
    if (space.currentContract !== space.targetContract || pending > 0) {
      throw new Error(
        `Prisma status is not up to date: current ${space.currentContract}, target ${space.targetContract}, ${pending} pending migration(s).`,
      );
    }
    return "The app contract is current with no pending migrations.";
  }
  if (command === "verify") return "The database contract marker and schema match.";
  if (command === "log") return "The migration log was read successfully.";
  throw new Error("Prisma returned a result for an unsupported operation.");
}

function isContractHash(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runPrismaMigration().catch((error) => {
    console.error(error instanceof Error ? error.message : "Prisma Migration operation failed.");
    process.exitCode = 2;
  });
}
