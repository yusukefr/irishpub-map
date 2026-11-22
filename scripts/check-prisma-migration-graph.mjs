import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

/** Re-emits the committed Contract and checks that committed migrations fully represent it. */
async function main() {
  run("npm", ["run", "prisma:contract:emit"]);
  assertClean(
    "generated/prisma8",
    "Committed Prisma Contract artifacts are stale; run npm run prisma:contract:emit and commit the result.",
  );

  // Planning is offline, but can write a new migration. CI detects that candidate and never commits or applies it.
  const graphTip = await findSingleMigrationTip();
  run("npm", ["exec", "--no", "--", "prisma", "migration", "plan", "--from", graphTip, "--name", "ci-check", "--json"]);
  assertClean(
    "migrations",
    "The current Contract has no committed migration; run migration plan locally and review its output.",
  );

  run("npm", ["exec", "--no", "--", "prisma", "migration", "check", "--space", "app"]);
  console.log("Prisma Contract artifacts and app Migration Graph are current.");
}

/** Resolves the sole terminal contract hash so plan never guesses an empty-database origin. */
async function findSingleMigrationTip() {
  const directory = resolve("migrations/app");
  const names = (await readdir(directory)).sort();
  const metadata = await Promise.all(
    names.map(async (name) => JSON.parse(await readFile(resolve(directory, name, "migration.json"), "utf8"))),
  );
  const starts = new Set(metadata.map((migration) => migration.from).filter((state) => typeof state === "string"));
  const tips = [...new Set(metadata.map((migration) => migration.to).filter((state) => !starts.has(state)))];
  if (tips.length !== 1) {
    throw new Error(
      `Expected one terminal Prisma contract state for migration planning; found ${tips.length}. Merge graph branches before CI planning.`,
    );
  }
  return tips[0];
}

/** Runs a local, database-free command without inheriting database credentials. */
function run(command, args) {
  const env = { ...process.env, CI: "true" };
  delete env.DATABASE_URL;
  delete env.DIRECT_URL;
  delete env.NEON_API_KEY;
  delete env.PRISMA_MIGRATION_DATABASE_URL;
  delete env.PRISMA_VALIDATION_DATABASE_URL;
  delete env.PRISMA_BASELINE_VERIFY_DATABASE_URL;

  const result = spawnSync(command, args, { encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] });
  if (result.error || result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.slice(0, 3).join(" ")} failed.`);
  }
  if (result.stdout) process.stdout.write(result.stdout);
}

/** Fails when the command generated or changed committed output. */
function assertClean(path, message) {
  const result = spawnSync("git", ["status", "--porcelain", "--untracked-files=all", "--", path], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) throw new Error(`Could not inspect ${path} after Prisma validation.`);
  if (result.stdout.trim()) throw new Error(message);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Prisma Migration Graph check failed.");
  process.exitCode = 1;
}
