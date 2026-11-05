import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertDirectConnection } from "./lib/resolve-neon-target.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const neonConfig = JSON.parse(readFileSync(resolve(repositoryRoot, "config/neon-targets.json"), "utf8"));
const projectId = neonConfig.projectId;
const targetBranchNames = new Set([neonConfig.targets.production.branchName, neonConfig.targets.preview.branchName]);
const validationBranchPrefix = "validation/issue-639/";
const commands = {
  preview: ["db", "migrate", "--show"],
  apply: ["db", "migrate", "--advance-ref", "db"],
  verify: ["db", "verify"],
  verifyStrict: ["db", "verify", "--schema-only", "--strict"],
  status: ["migration", "status"],
  log: ["migration", "log"],
};

/**
 * Parses the small allowlisted command line surface for Issue #639.
 * @param {string[]} argv CLI arguments after the script name.
 * @returns {{branchId: string, confirmation: string, command: keyof typeof commands}}
 */
export function parseValidationArgs(argv) {
  let branchId;
  let confirmation;
  let command;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--branch-id") branchId = argv[++index];
    else if (token === "--confirm-data-free") confirmation = argv[++index];
    else if (token.startsWith("--")) throw new Error("Only --branch-id and --confirm-data-free are accepted.");
    else if (command) throw new Error("Only one Prisma validation command may be selected.");
    else command = token;
  }

  if (!branchId || !/^br-[a-z0-9-]+$/i.test(branchId)) {
    throw new Error("--branch-id must contain an explicit Neon Branch ID.");
  }
  if (confirmation !== branchId) {
    throw new Error(
      "--confirm-data-free must repeat the selected Branch ID after confirming it contains no production data.",
    );
  }
  if (!command || !Object.hasOwn(commands, command)) {
    throw new Error(`A supported command is required: ${Object.keys(commands).join(", ")}.`);
  }
  return { branchId, confirmation, command };
}

/**
 * Fails closed unless the explicit Branch belongs to the project and is a ready Issue #639 validation Branch.
 * @param {unknown[]} branches Branch records from Neon CLI.
 * @param {string} branchId Explicit Branch ID.
 * @returns {{id: string, name: string}}
 */
export function validateValidationBranch(branches, branchId) {
  const branch = branches.find((candidate) => candidate?.id === branchId);
  if (!branch) throw new Error("Neon Branch ID was not found in the configured project.");
  if (branch.project_id !== projectId)
    throw new Error("Neon Branch is not confirmed as part of the configured project.");
  if (targetBranchNames.has(branch.name) || branch.primary || branch.default) {
    throw new Error("Production and fixed Preview Branches cannot be used for validation.");
  }
  if (typeof branch.name !== "string" || !branch.name.startsWith(validationBranchPrefix)) {
    throw new Error(`Validation Branch name must start with ${validationBranchPrefix}.`);
  }
  if ((branch.current_state ?? branch.state) !== "ready") throw new Error("Neon validation Branch is not ready.");
  return { id: branch.id, name: branch.name };
}

/**
 * Resolves an unpooled endpoint from Neon CLI without exposing the URI in arguments or logs.
 * @param {{id: string, name: string}} branch Validated Branch.
 * @param {(args: string[]) => {status: number|null, stdout?: string, error?: Error}} runNeonCli Injected Neon CLI runner.
 * @returns {string} Direct endpoint for transient child-process environment only.
 */
export function resolveValidationConnection(branch, runNeonCli = runNeon) {
  const result = runNeonCli(["connection-string", branch.id, "--project-id", projectId]);
  if (result.error || result.status !== 0 || !result.stdout?.trim()) {
    throw new Error("Neon CLI could not resolve the validation Branch connection.");
  }
  const connection = result.stdout.trim();
  assertDirectConnection(connection);
  if (!new URL(connection).hostname.toLowerCase().endsWith(".neon.tech")) {
    throw new Error("Validation Branch connection is not a Neon endpoint.");
  }
  return connection;
}

/**
 * Runs one allowlisted Prisma operation using a transient config and a secret child environment.
 * @param {keyof typeof commands} command Allowed operation name.
 * @param {string} databaseUrl Neon Direct endpoint.
 * @param {(file: string, contents: string) => boolean|void} writeConfig Config writer for tests; true marks the generated directory as owned by this invocation.
 * @param {(args: string[], env: NodeJS.ProcessEnv) => {status: number|null, stdout?: string, stderr?: string, error?: Error}} runPrismaCli Injected Prisma CLI runner.
 * @returns {{status: number|null, stdout: string, stderr: string}}
 */
export function runValidationCommand(
  command,
  databaseUrl,
  { writeConfig = writeValidationConfig, runPrismaCli = runPrisma } = {},
) {
  const token = randomBytes(8).toString("hex");
  const configDirectory = resolve(repositoryRoot, "config", `.prisma-validation-${token}`);
  const configPath = resolve(configDirectory, "prisma.config.ts");
  const configContents = `import { defineConfig as definePostgresConfig } from "@prisma/orm-postgres/config";
import { definePrismaConfig } from "prisma/config";

const databaseUrl = process.env.PRISMA_VALIDATION_DATABASE_URL;
if (!databaseUrl) throw new Error("Validation connection is unavailable.");

export default definePrismaConfig({
  parent: false,
  orm: definePostgresConfig({
    contract: "../../db/prisma/contract.prisma",
    output: "../../generated/prisma8",
    migrations: { dir: "../../migrations" },
    db: { connection: databaseUrl },
  }),
});
`;

  let configCreated = false;
  try {
    configCreated = writeConfig(configPath, configContents) === true;
    const result = runPrismaCli([...commands[command], "--config", configPath], {
      PRISMA_VALIDATION_DATABASE_URL: databaseUrl,
    });
    return {
      status: result.status,
      stdout: (result.stdout ?? "").replaceAll(databaseUrl, "[REDACTED DATABASE URL]"),
      stderr: (result.stderr ?? "").replaceAll(databaseUrl, "[REDACTED DATABASE URL]"),
    };
  } finally {
    if (configCreated) rmSync(configDirectory, { recursive: true, force: true });
  }
}

/**
 * Validates an explicitly selected data-free Branch before invoking an allowlisted Prisma command.
 * @param {{argv?: string[], env?: NodeJS.ProcessEnv, runNeonCli?: (args: string[]) => {status: number|null, stdout?: string, error?: Error}, runPrismaCli?: (args: string[], env: NodeJS.ProcessEnv) => {status: number|null, stdout?: string, stderr?: string, error?: Error}, stdout?: NodeJS.WriteStream, stderr?: NodeJS.WriteStream}} options Testable dependencies and streams.
 * @returns {number} Process exit status.
 */
export function runPrismaValidation({
  argv = process.argv.slice(2),
  runNeonCli = runNeon,
  runPrismaCli = runPrisma,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  try {
    const { branchId, command } = parseValidationArgs(argv);
    const branchesResult = runNeonCli(["branches", "list", "--project-id", projectId, "--output", "json"]);
    if (branchesResult.error || branchesResult.status !== 0 || !branchesResult.stdout) {
      throw new Error("Neon CLI could not list the configured project's Branches.");
    }
    let parsed;
    try {
      parsed = JSON.parse(branchesResult.stdout);
    } catch {
      throw new Error("Neon CLI returned invalid Branch data.");
    }
    const branches = Array.isArray(parsed) ? parsed : parsed?.branches;
    if (!Array.isArray(branches)) throw new Error("Neon CLI omitted Branch data.");
    const branch = validateValidationBranch(branches, branchId);
    const connection = resolveValidationConnection(branch, runNeonCli);
    const result = runValidationCommand(command, connection, { runPrismaCli });
    if (result.stdout) stdout.write(result.stdout);
    if (result.stderr) stderr.write(result.stderr);
    if (result.error || result.status !== 0) {
      const exitCode = result.status ?? 1;
      stderr.write(`Prisma ${command} failed on validated Branch ${branch.name} (exit ${exitCode}).\n`);
      return exitCode;
    }
    stdout.write(`Prisma ${command} completed on validated Branch ${branch.name} (${branch.id}).\n`);
    return 0;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 2;
  }
}

function runNeon(args) {
  return spawnSync("npm", ["exec", "--no", "--", "neon", ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

export function runPrisma(args, validationEnvironment, spawn = spawnSync) {
  const env = { ...process.env, ...validationEnvironment };
  delete env.DATABASE_URL;
  delete env.DIRECT_URL;
  return spawn("npm", ["exec", "--no", "--", "prisma", ...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env,
  });
}

function writeValidationConfig(configPath, contents) {
  const directory = dirname(configPath);
  mkdirSync(directory, { mode: 0o700 });
  try {
    writeFileSync(configPath, contents, { flag: "wx", mode: 0o600 });
    return true;
  } catch (error) {
    rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exitCode = runPrismaValidation();
}
