import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CONFIG_PATH = "config/neon-targets.json";

/** Neon CLIのAPI応答を使い、Repositoryで指定されたTargetの接続情報を解決します。 */
export async function resolveNeonTarget(
  targetName,
  { readConfig = readFile, runCli = runNeonCli, cwd = process.cwd() } = {},
) {
  if (targetName !== "preview" && targetName !== "production") {
    throw new Error("--target must be preview or production.");
  }

  let config;
  try {
    config = JSON.parse(await readConfig(`${cwd}/${CONFIG_PATH}`, "utf8"));
  } catch {
    throw new Error(`${CONFIG_PATH} is missing or invalid.`);
  }

  const configuredTarget = config?.targets?.[targetName];
  if (
    typeof config?.projectId !== "string" ||
    typeof configuredTarget?.branchName !== "string" ||
    !config.projectId ||
    !configuredTarget.branchName
  ) {
    throw new Error(`${CONFIG_PATH} must define projectId and ${targetName}.branchName.`);
  }

  const projectId = config.projectId;
  let branches;
  try {
    const response = await runCli(["api", `/projects/${encodeURIComponent(projectId)}/branches`, "--output", "json"]);
    branches = parseJson(response).branches;
  } catch {
    throw new Error("Could not resolve Neon branches. Check Neon CLI installation and authentication.");
  }

  const branch = Array.isArray(branches) ? branches.find((entry) => entry.name === configuredTarget.branchName) : null;
  if (!branch?.id) {
    throw new Error(`Neon branch configured for ${targetName} was not found in project ${projectId}.`);
  }

  let connectionString;
  try {
    connectionString = String(await runCli(["connection-string", branch.id, "--project-id", projectId])).trim();
  } catch {
    throw new Error(`Could not resolve a direct connection for Neon target ${targetName}.`);
  }

  if (!connectionString) {
    throw new Error(`Could not resolve a direct connection for Neon target ${targetName}.`);
  }
  assertDirectConnection(connectionString);

  return {
    target: targetName,
    projectId,
    branchName: branch.name,
    branchId: branch.id,
    connectionString,
    authSource: "neon-cli",
  };
}

/** Migration用接続URLからPooled Endpointを拒否します。 */
export function assertDirectConnection(connectionString) {
  let hostname;
  try {
    const uri = new URL(connectionString);
    if (uri.protocol !== "postgres:" && uri.protocol !== "postgresql:") throw new Error("Invalid protocol");
    hostname = uri.hostname;
  } catch {
    throw new Error("Neon returned an invalid connection URI.");
  }
  if (hostname.includes("-pooler")) throw new Error("Pooled Neon connections cannot be used for migrations.");
}

function parseJson(value) {
  if (typeof value !== "string") return value;
  return JSON.parse(value);
}

async function runNeonCli(args) {
  try {
    const { stdout } = await execFileAsync("neon", args, { encoding: "utf8", maxBuffer: 1024 * 1024 });
    return stdout;
  } catch {
    // Neon CLIのstderrは接続情報を含む可能性があるため、呼び出し元へ渡しません。
    throw new Error("Neon CLI command failed.");
  }
}
