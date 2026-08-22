import { spawn } from "node:child_process";
import process from "node:process";

const PHASES = {
  prepare: ["db/migrations/006_localize_display_data_up.sql", "db/migrations/006_localize_display_data_verify.sql"],
};

/**
 * ローカライズ移行の各段階で実行するSQLを返します。
 * @param {string} phase - 実行対象の移行段階。
 * @returns {string[]} 順番に実行するmigrationファイル。
 */
export function getLocalizationMigrationFiles(phase) {
  const files = PHASES[phase];
  if (!files) throw new Error(`Unknown localization migration phase: ${phase}`);
  return files;
}

/**
 * 指定されたmigrationファイルを既存のNeon migrationランナーで実行します。
 * @param {string} migrationPath - 実行するSQLファイル。
 * @returns {Promise<void>} 子プロセスの終了後に完了します。
 */
function runMigration(migrationPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/run-neon-migration.mjs", migrationPath], {
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Migration failed: ${migrationPath}`));
    });
  });
}

async function main() {
  const [command = "plan", phase = "prepare", confirmation] = process.argv.slice(2);
  if (command === "plan") {
    for (const migrationPath of getLocalizationMigrationFiles(phase)) {
      console.log(`node scripts/run-neon-migration.mjs ${migrationPath}`);
    }
    return;
  }

  if (command !== "apply" || confirmation !== "--confirm") {
    throw new Error("Usage: node scripts/run-localization-migration.mjs <plan|apply> [prepare] [--confirm]");
  }

  for (const migrationPath of getLocalizationMigrationFiles(phase)) {
    await runMigration(migrationPath);
  }
}

if (process.argv[1]?.endsWith("run-localization-migration.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
