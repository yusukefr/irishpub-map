import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CONFIG_PATH = "config/neon-targets.json";

/** Neon CLIで全Branchを列挙し、Repositoryで指定されたTargetの接続情報を解決します。 */
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
    // API結果で認証とProject権限を判定し、CIモードで対話ログインを防ぎます。
    const response = await runCli(["branches", "list", "--project-id", projectId, "--output", "json"]);
    const branchResponse = parseJson(response);
    branches = Array.isArray(branchResponse) ? branchResponse : branchResponse?.branches;
  } catch (error) {
    throw normalizeNeonCliError(error);
  }

  const branch = Array.isArray(branches) ? branches.find((entry) => entry.name === configuredTarget.branchName) : null;
  if (!branch?.id) {
    throw new Error(
      `NEON_BRANCH_NOT_FOUND: Neon branch configured for ${targetName} was not found in project ${projectId}.`,
    );
  }
  const branchState = branch.current_state ?? branch.state;
  if (branchState !== "ready") {
    throw new Error(
      `NEON_BRANCH_NOT_READY: Neon branch ${branch.name} (${branch.id}) is ${branchState ?? "unknown"}; wait until it is ready.`,
    );
  }

  let connectionString;
  try {
    connectionString = String(await runCli(["connection-string", branch.id, "--project-id", projectId])).trim();
  } catch (error) {
    if (isAuthenticationError(error)) throw authUnavailableError();
    if (isProjectPermissionError(error)) throw projectAccessDeniedError();
    throw new Error(`NEON_CONNECTION_FAILED: Could not resolve a direct connection for Neon target ${targetName}.`);
  }

  if (!connectionString) {
    throw new Error(`NEON_CONNECTION_FAILED: Could not resolve a direct connection for Neon target ${targetName}.`);
  }
  assertDirectConnection(connectionString);

  return {
    target: targetName,
    projectId,
    branchName: branch.name,
    branchId: branch.id,
    branchState,
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
    throw new Error("NEON_CONNECTION_FAILED: Neon returned an invalid connection URI.");
  }
  if (hostname.includes("-pooler")) {
    throw new Error("NEON_CONNECTION_FAILED: Pooled Neon connections cannot be used for migrations.");
  }
}

function parseJson(value) {
  if (typeof value !== "string") return value;
  return JSON.parse(value);
}

async function runNeonCli(args) {
  try {
    const { stdout } = await execFileAsync("neon", args, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      env: { ...process.env, CI: "true" },
    });
    return stdout;
  } catch (error) {
    // Preserve only a classification; CLI output may contain credentials or connection details.
    const sanitized = new Error("Neon CLI command failed.");
    sanitized.code = error?.code;
    sanitized.isAuthenticationError = isAuthenticationError(error);
    sanitized.isProjectPermissionError = isProjectPermissionError(error);
    throw sanitized;
  }
}

function normalizeNeonCliError(error) {
  if (error?.code === "ENOENT") {
    return new Error("NEON_CLI_NOT_INSTALLED: Install dependencies with npm ci so the local Neon CLI is available.");
  }
  if (isAuthenticationError(error)) return authUnavailableError();
  if (isProjectPermissionError(error)) return projectAccessDeniedError();
  return new Error(
    "NEON_CONNECTION_FAILED: Could not resolve Neon branches. Check network access and project permissions.",
  );
}

function isAuthenticationError(error) {
  if (error?.isAuthenticationError) return true;
  const message = `${error?.message ?? ""} ${error?.stderr ?? ""}`;
  return /not signed in|not authenticated|unauthori[sz]ed|authentication required|cannot run interactive auth in ci|\b401\b|no api key|api key.*(missing|invalid|required)/i.test(
    message,
  );
}

function isProjectPermissionError(error) {
  if (error?.isProjectPermissionError) return true;
  const message = `${error?.message ?? ""} ${error?.stderr ?? ""}`;
  return /\b403\b|\b404\b|forbidden|not found|project.*does not exist|(?:not allowed|no access).*project|project.*(?:not allowed|no access)/i.test(
    message,
  );
}

function authUnavailableError() {
  return new Error(
    "NEON_AUTH_UNAVAILABLE: Provide NEON_API_KEY as a secret or run `neon auth` in an interactive session, then retry.",
  );
}

function projectAccessDeniedError() {
  return new Error(
    "NEON_PROJECT_ACCESS_DENIED: Check that the configured project ID is correct and the Neon credential can access that project.",
  );
}
