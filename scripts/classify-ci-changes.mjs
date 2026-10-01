import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const DOCS_ROOT_FILES = new Set(["README.md", "AGENTS.md", "LICENSE"]);

/**
 * 変更ファイルの用途を分類する。未知のパスは検証とversion更新の対象にする。
 * @param {string[]} paths Git差分に含まれる旧・新両方のパス
 * @returns {{codeChanged: boolean, openapiChanged: boolean, workflowChanged: boolean, versionRelevant: boolean}}
 */
export function classifyPaths(paths) {
  if (paths.length === 0) return fullChange();

  const result = {
    codeChanged: false,
    openapiChanged: false,
    workflowChanged: false,
    versionRelevant: false,
  };

  for (const path of paths) {
    if (path.startsWith("docs/specs/openapi/")) {
      result.openapiChanged = true;
    } else if (!isDocsOnlyPath(path)) {
      result.codeChanged = true;
    }

    if (path.startsWith(".github/workflows/")) result.workflowChanged = true;
    if (!isDocsOnlyPath(path) && !path.startsWith("docs/specs/openapi/") && !path.startsWith(".github/")) {
      result.versionRelevant = true;
    }
  }

  return result;
}

function isDocsOnlyPath(path) {
  return (
    DOCS_ROOT_FILES.has(path) ||
    (path.startsWith("docs/") && !path.startsWith("docs/specs/openapi/")) ||
    path.startsWith(".agents/") ||
    path.startsWith(".codex/")
  );
}

function fullChange() {
  return {
    codeChanged: true,
    openapiChanged: true,
    workflowChanged: true,
    versionRelevant: true,
  };
}

/**
 * 比較元を取得できない場合は全検証を実行する。renameの旧パスも評価する。
 * @param {{eventName: string, baseSha: string, headSha: string}} event
 * @returns {ReturnType<typeof classifyPaths>}
 */
export function classifyGitChange(event) {
  if (event.eventName === "workflow_dispatch") return fullChange();
  if (!/^[0-9a-f]{40}$/i.test(event.baseSha) || !/^[0-9a-f]{40}$/i.test(event.headSha)) {
    return fullChange();
  }
  if (/^0+$/.test(event.baseSha)) return fullChange();

  const separator = event.eventName === "pull_request" ? "..." : "..";
  try {
    const output = execFileSync(
      "git",
      ["diff", "--name-only", "--no-renames", "-z", `${event.baseSha}${separator}${event.headSha}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return classifyPaths(output.split("\0").filter(Boolean));
  } catch {
    return fullChange();
  }
}

if (process.argv[1]?.endsWith("classify-ci-changes.mjs")) {
  const result = classifyGitChange({
    eventName: process.env.CI_EVENT_NAME ?? "",
    baseSha: process.env.CI_BASE_SHA ?? "",
    headSha: process.env.CI_HEAD_SHA ?? "",
  });
  const output = [
    `code_changed=${result.codeChanged}`,
    `openapi_changed=${result.openapiChanged}`,
    `workflow_changed=${result.workflowChanged}`,
    `version_relevant=${result.versionRelevant}`,
  ].join("\n");
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`);
  process.stdout.write(`${output}\n`);
}
