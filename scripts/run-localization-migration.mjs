import { spawn } from "node:child_process";
import process from "node:process";
import { Client } from "@neondatabase/serverless";

const PHASES = {
  prepare: ["db/migrations/006_localize_display_data_up.sql", "db/migrations/006_localize_display_data_verify.sql"],
  finalize: ["db/migrations/007_finalize_localization_up.sql", "db/migrations/007_finalize_localization_verify.sql"],
};
export function getLocalizationMigrationFiles(phase) {
  const files = PHASES[phase];
  if (!files) throw new Error(`Unknown localization migration phase: ${phase}`);
  return files;
}
function runMigration(migrationPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/run-neon-migration.mjs", migrationPath], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`Migration failed: ${migrationPath}`))));
  });
}
async function isMigrationApplied(migrationPath) {
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) throw new Error("MIGRATION_DATABASE_URL is required.");
  const client = new Client(connectionString);
  await client.connect();
  try {
    const table = await client.query("SELECT to_regclass('public.schema_migrations') AS table_name");
    if (!table.rows[0]?.table_name) return false;
    const version = migrationPath.split("/").pop()?.replace("_up.sql", "");
    return (await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version])).rowCount === 1;
  } finally {
    await client.end();
  }
}
async function main() {
  const [command = "plan", phase = "prepare", confirmation] = process.argv.slice(2);
  if (command === "plan") {
    for (const migrationPath of getLocalizationMigrationFiles(phase))
      console.log(`node scripts/run-neon-migration.mjs ${migrationPath}`);
    return;
  }
  if (command !== "apply" || confirmation !== "--confirm")
    throw new Error("Usage: node scripts/run-localization-migration.mjs <plan|apply> [prepare] [--confirm]");
  for (const migrationPath of getLocalizationMigrationFiles(phase)) {
    if (migrationPath.endsWith("_up.sql") && (await isMigrationApplied(migrationPath))) {
      console.log(`Skipping already applied migration: ${migrationPath}`);
      continue;
    }
    await runMigration(migrationPath);
  }
}
if (process.argv[1]?.endsWith("run-localization-migration.mjs"))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
