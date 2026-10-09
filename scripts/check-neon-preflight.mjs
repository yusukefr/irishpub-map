import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { Client } from "@neondatabase/serverless";
import { resolveNeonTarget } from "./lib/resolve-neon-target.mjs";

const MIGRATIONS_DIRECTORY = "db/migrations";

/** Parses the read-only preflight options. */
export function parsePreflightArguments(inputArgs) {
  let target;
  let requiredMigration;
  for (let index = 0; index < inputArgs.length; index += 1) {
    const argument = inputArgs[index];
    if (argument === "--target" && !target) target = inputArgs[++index];
    else if (argument === "--required-migration" && !requiredMigration) requiredMigration = inputArgs[++index];
    else throw new Error(`Unknown or repeated option: ${argument}`);
  }

  if (!target || !requiredMigration || !/^[0-9]{3}_[a-z0-9_]+$/.test(requiredMigration)) {
    throw new Error("Usage: npm run db:preflight -- --target preview|production --required-migration <version_name>");
  }
  if (target !== "preview" && target !== "production") throw new Error("--target must be preview or production.");
  return { target, requiredMigration };
}

/** Returns migrations that must be recorded through the requested migration. */
export async function getRequiredMigrationVersions(
  requiredMigration,
  { readDirectory = readdir, cwd = process.cwd() } = {},
) {
  const filenames = await readDirectory(resolve(cwd, MIGRATIONS_DIRECTORY));
  const versions = filenames
    .filter((filename) => /^\d{3}_[a-z0-9_]+_up\.sql$/.test(filename))
    .map((filename) => filename.slice(0, -"_up.sql".length))
    .filter((version) => Number(version.slice(0, 3)) >= 6)
    .sort();
  const requiredIndex = versions.indexOf(requiredMigration);
  if (requiredIndex < 0) throw new Error(`Unknown repository migration: ${requiredMigration}.`);
  return versions.slice(0, requiredIndex + 1);
}

/** Checks the selected branch's migration history using a read-only transaction. */
export async function runNeonPreflight(
  { target, requiredMigration },
  {
    resolveTarget: resolveTargetFn = resolveNeonTarget,
    readDirectory = readdir,
    createClient = (connectionString) => new Client(connectionString),
    cwd = process.cwd(),
  } = {},
) {
  const resolvedTarget = await resolveTargetFn(target);
  const requiredVersions = await getRequiredMigrationVersions(requiredMigration, { readDirectory, cwd });
  console.log(`Target:       ${resolvedTarget.target}`);
  console.log(`Project:      ${resolvedTarget.projectId}`);
  console.log(`Branch:       ${resolvedTarget.branchName}`);
  console.log(`Branch ID:    ${resolvedTarget.branchId}`);
  console.log(`Branch state: ${resolvedTarget.branchState}`);
  console.log("Connection:   direct");
  const client = createClient(resolvedTarget.connectionString);
  let inReadOnlyTransaction = false;
  let appliedVersions;
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    inReadOnlyTransaction = true;
    const result = await client.query("SELECT version FROM schema_migrations");
    appliedVersions = new Set(result.rows.map((row) => row.version));
  } catch {
    throw new Error(
      `NEON_CONNECTION_FAILED: Could not read migration history from ${resolvedTarget.branchName} (${resolvedTarget.branchId}).`,
    );
  } finally {
    if (inReadOnlyTransaction) await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }

  const missingVersions = requiredVersions.filter((version) => !appliedVersions.has(version));
  if (missingVersions.length > 0) {
    throw new Error(
      `MIGRATION_PREREQUISITE_MISSING: ${resolvedTarget.branchName} is missing migrations required through ${requiredMigration}: ${missingVersions.join(", ")}. Apply and verify them in order on this branch.`,
    );
  }

  console.log(`Migration:    ${requiredMigration} and prior repository migrations are recorded`);
  console.log("Database:     read-only check; no changes made");
}

async function main() {
  await runNeonPreflight(parsePreflightArguments(process.argv.slice(2)));
}

if (process.argv[1]?.endsWith("check-neon-preflight.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Neon preflight failed.");
    process.exitCode = 1;
  });
}
