import { spawn } from "node:child_process";
import process from "node:process";
import { Client } from "@neondatabase/serverless";
import { resolveNeonTarget } from "./lib/resolve-neon-target.mjs";

const PHASES = {
  prepare: ["db/migrations/006_localize_display_data_up.sql", "db/migrations/006_localize_display_data_verify.sql"],
  finalize: ["db/migrations/007_finalize_localization_up.sql", "db/migrations/007_finalize_localization_verify.sql"],
};
export function getLocalizationMigrationFiles(phase) {
  const files = PHASES[phase];
  if (!files) throw new Error(`Unknown localization migration phase: ${phase}`);
  return files;
}
function runMigration(migrationPath, target) {
  return new Promise((resolve, reject) => {
    const args = ["scripts/run-neon-migration.mjs", "--target", target];
    if (target === "production") args.push("--confirm-production");
    args.push(migrationPath);
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Migration failed: ${migrationPath}`))));
  });
}
async function isMigrationApplied(migrationPath, connectionString) {
  const client = new Client(connectionString);
  try {
    await client.connect();
    const table = await client.query("SELECT to_regclass('public.schema_migrations') AS table_name");
    if (!table.rows[0]?.table_name) return false;
    const version = migrationPath.split("/").pop()?.replace("_up.sql", "");
    return (await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version])).rowCount === 1;
  } catch {
    throw new Error("Could not read migration state from the selected Neon target.");
  } finally {
    await client.end().catch(() => {});
  }
}
async function main() {
  const [command = "plan", phase = "prepare", ...options] = process.argv.slice(2);
  let target;
  let confirmed = false;
  let confirmProduction = false;
  while (options.length > 0) {
    const option = options.shift();
    if (option === "--target") target = options.shift();
    else if (option === "--confirm") confirmed = true;
    else if (option === "--confirm-production") confirmProduction = true;
    else throw new Error(`Unknown option: ${option}`);
  }
  if (target !== "preview" && target !== "production") {
    throw new Error(
      "Usage: node scripts/run-localization-migration.mjs <plan|apply> [prepare|finalize] --target preview|production [--confirm] [--confirm-production]",
    );
  }
  if (command === "plan") {
    for (const migrationPath of getLocalizationMigrationFiles(phase))
      console.log(
        `npm run db:migrate -- --target ${target}${target === "production" ? " --confirm-production" : ""} ${migrationPath}`,
      );
    return;
  }
  if (command !== "apply" || !confirmed) throw new Error("Applying a localization migration requires --confirm.");
  if (target === "production" && !confirmProduction)
    throw new Error("Production localization migration requires --confirm-production.");
  if (target === "preview" && confirmProduction) throw new Error("--confirm-production is only valid for production.");

  const resolvedTarget = await resolveNeonTarget(target);
  for (const migrationPath of getLocalizationMigrationFiles(phase)) {
    if (
      migrationPath.endsWith("_up.sql") &&
      (await isMigrationApplied(migrationPath, resolvedTarget.connectionString))
    ) {
      console.log(`Skipping already applied migration: ${migrationPath}`);
      continue;
    }
    await runMigration(migrationPath, target);
  }
}
if (process.argv[1]?.endsWith("run-localization-migration.mjs"))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
