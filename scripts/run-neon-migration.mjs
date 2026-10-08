import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { Client } from "@neondatabase/serverless";
import { resolveNeonTarget } from "./lib/resolve-neon-target.mjs";

export function prepareMigrationSql(sql) {
  return sql.replace(/^\\set ON_ERROR_STOP on\s*$/m, "");
}

/** Migration CLI引数を検証し、TargetのProduction Guardを適用します。 */
export function parseMigrationArguments(inputArgs) {
  const args = [...inputArgs];
  let target;
  let confirmProduction = false;
  const positional = [];
  while (args.length > 0) {
    const argument = args.shift();
    if (argument === "--target") {
      if (target) throw new Error("--target may be specified only once.");
      target = args.shift();
    } else if (argument === "--confirm-production") confirmProduction = true;
    else if (argument.startsWith("--")) throw new Error(`Unknown option: ${argument}`);
    else positional.push(argument);
  }

  if (positional.length !== 1 || !target) {
    throw new Error("Usage: npm run db:migrate -- --target preview|production [--confirm-production] <migration.sql>");
  }
  if (target === "production" && !confirmProduction)
    throw new Error("Production migration requires --confirm-production.");
  if (target !== "production" && confirmProduction)
    throw new Error("--confirm-production is only valid for production.");

  return { target, migrationPath: positional[0] };
}

/**
 * Neon ClientでSQLマイグレーションファイルを実行します。
 * 接続先は共通Neon Target Resolverで解決し、接続文字列はログへ出力しません。
 */
async function main() {
  const { target, migrationPath } = parseMigrationArguments(process.argv.slice(2));

  const resolvedTarget = await resolveNeonTarget(target);
  const sql = prepareMigrationSql(await readFile(resolve(process.cwd(), migrationPath), "utf8"));
  const client = new Client(resolvedTarget.connectionString);

  try {
    await client.connect();
    await client.query(sql);
    console.log(`Migration completed for ${resolvedTarget.target} (${resolvedTarget.branchName}).`);
  } catch {
    throw new Error("Neon migration failed. Review the SQL and the selected target without exposing database output.");
  } finally {
    await client.end().catch(() => {});
  }
}

if (process.argv[1]?.endsWith("run-neon-migration.mjs"))
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Neon migration failed.");
    process.exitCode = 1;
  });
