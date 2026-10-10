import process from "node:process";
import { Client } from "@neondatabase/serverless";
import { resolveNeonTarget } from "./lib/resolve-neon-target.mjs";

/** Targetの接続設定とDBへの疎通を確認し、Secretを含まない概要だけを表示します。 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--target") {
    throw new Error("Usage: npm run db:connection-check -- --target preview|production");
  }

  const resolvedTarget = await resolveNeonTarget(args[1]);
  const client = new Client(resolvedTarget.connectionString);
  try {
    await client.connect();
    await client.query("SELECT 1");
  } catch {
    throw new Error(`NEON_CONNECTION_FAILED: Could not connect to Neon target ${resolvedTarget.target}.`);
  } finally {
    await client.end().catch(() => {});
  }

  console.log(`Target:       ${resolvedTarget.target}`);
  console.log(`Project:      ${resolvedTarget.projectId}`);
  console.log(`Branch:       ${resolvedTarget.branchName}`);
  console.log(`Branch ID:    ${resolvedTarget.branchId}`);
  console.log(`Branch state: ${resolvedTarget.branchState}`);
  console.log("Connection:   direct");
  console.log("Auth source:  neon-cli");
}

if (process.argv[1]?.endsWith("check-neon-connection.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Neon connection check failed.");
    process.exitCode = 1;
  });
}
