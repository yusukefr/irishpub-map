import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { Client } from "@neondatabase/serverless";

/**
 * Neon ClientでSQLマイグレーションファイルを実行します。
 * 接続文字列はログへ出力せず、MIGRATION_DATABASE_URLからのみ取得します。
 */
async function main() {
  const [migrationPath, ...extraArgs] = process.argv.slice(2);
  if (!migrationPath || extraArgs.length > 0) {
    throw new Error("Usage: node scripts/run-neon-migration.mjs <migration.sql>");
  }

  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) {
    throw new Error("MIGRATION_DATABASE_URL is required.");
  }

  const sql = await readFile(resolve(process.cwd(), migrationPath), "utf8");
  const client = new Client(connectionString);

  await client.connect();
  try {
    const result = await client.query(sql);
    const results = Array.isArray(result) ? result : [result];
    for (const queryResult of results) {
      if (queryResult.rows?.length > 0) {
        console.log(JSON.stringify(queryResult.rows));
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
