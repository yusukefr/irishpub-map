import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databaseTargets = [
  { name: "signed verification database", variable: "PRISMA_SIGNED_DATABASE_URL" },
  { name: "empty baseline database", variable: "PRISMA_EMPTY_DATABASE_URL" },
];

function databaseIdentity(value, variable) {
  if (!value) throw new Error(`${variable} is required.`);

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variable} must be a valid PostgreSQL URL.`);
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
    throw new Error(`${variable} must identify a PostgreSQL database.`);
  }

  return `${url.hostname.toLowerCase()}${url.port ? `:${url.port}` : ""}${url.pathname}`;
}

function runPrisma(args) {
  return spawnSync("npm", ["exec", "--", "prisma", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function verifyPrismaBaseline({
  env = process.env,
  run = runPrisma,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  let signedIdentity;
  let emptyIdentity;
  try {
    signedIdentity = databaseIdentity(env.PRISMA_SIGNED_DATABASE_URL, "PRISMA_SIGNED_DATABASE_URL");
    emptyIdentity = databaseIdentity(env.PRISMA_EMPTY_DATABASE_URL, "PRISMA_EMPTY_DATABASE_URL");
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 2;
  }

  if (signedIdentity === emptyIdentity) {
    stderr.write("The signed verification database and empty baseline database must be different databases.\n");
    return 2;
  }

  for (const target of databaseTargets) {
    const databaseUrl = env[target.variable];
    for (const command of ["verify", "status"]) {
      const args =
        command === "verify" ? ["db", "verify", "--db", databaseUrl] : ["migration", "status", "--db", databaseUrl];
      const result = run(args);
      if (result.error || result.status !== 0) {
        const exitCode = result.status ?? 1;
        stderr.write(`${target.name}: Prisma ${command} failed (exit ${exitCode}).\n`);
        return 1;
      }
    }
    stdout.write(`${target.name}: schema and migration status verified.\n`);
  }

  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = verifyPrismaBaseline();
}
