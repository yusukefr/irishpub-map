import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { compareReleaseTags } from "./prepare-release.mjs";

const DOCS_ROOT_FILES = new Set(["README.md", "AGENTS.md", "LICENSE"]);
const RELEASE_ROOT_FILES = new Set(["package.json", "package-lock.json", "vercel.json", ".nvmrc", ".npmrc"]);
const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function changedPaths(cwd, range) {
  return execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", range], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split("\0")
    .filter(Boolean);
}

function isAncestor(cwd, ancestor, descendant) {
  try {
    git(cwd, "merge-base", "--is-ancestor", ancestor, descendant);
    return true;
  } catch {
    return false;
  }
}

/**
 * 変更ファイルの用途を分類する。未知のパスは検証の対象にする。
 * @param {string[]} paths Git差分に含まれる旧・新両方のパス
 * @returns {{codeChanged: boolean, openapiChanged: boolean, workflowChanged: boolean, releaseRelevant: boolean}}
 */
export function classifyPaths(paths) {
  if (paths.length === 0) return fullChange();

  const result = {
    codeChanged: false,
    openapiChanged: false,
    workflowChanged: false,
    releaseRelevant: false,
  };

  for (const path of paths) {
    if (path.startsWith("docs/specs/openapi/")) {
      result.openapiChanged = true;
    } else if (!isDocsOnlyPath(path)) {
      result.codeChanged = true;
    }

    if (path.startsWith(".github/workflows/")) result.workflowChanged = true;
    if (isReleaseRelevantPath(path)) result.releaseRelevant = true;
  }

  return result;
}

function isReleaseRelevantPath(path) {
  if (path === "apps/web/AGENTS.md") return false;
  return (
    path.startsWith("apps/") ||
    path.startsWith("packages/") ||
    RELEASE_ROOT_FILES.has(path) ||
    path === "scripts/validate-production-env.mjs"
  );
}

/** 最新Production Tagから対象commitまでに未Releaseの成果物変更があるか判定します。 */
export function classifyReleaseChanges({ cwd = process.cwd(), headSha } = {}) {
  if (!/^[0-9a-f]{40}$/i.test(headSha ?? "")) throw new Error("A full release commit SHA is required.");
  const tags = git(cwd, "tag", "--list")
    .split("\n")
    .filter((tag) => RELEASE_TAG.test(tag))
    .sort(compareReleaseTags);
  if (tags.length === 0) throw new Error("An annotated baseline release tag is required.");

  const latest = tags.at(-1);
  if (git(cwd, "cat-file", "-t", `refs/tags/${latest}`) !== "tag") {
    throw new Error(`Release tag ${latest} must be annotated.`);
  }
  const releasedSha = git(cwd, "rev-parse", `${latest}^{commit}`);
  if (isAncestor(cwd, headSha, releasedSha)) return false;
  if (!isAncestor(cwd, releasedSha, headSha)) {
    throw new Error(`Release tag ${latest} is not an ancestor of the target commit.`);
  }
  return changedPaths(cwd, `${releasedSha}..${headSha}`).some(isReleaseRelevantPath);
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
    releaseRelevant: false,
  };
}

/** mainの未Release変更もFull CIで検証し、PRでは従来の変更分類を維持します。 */
export function shouldRunFullCi(result, eventName) {
  return result.codeChanged || (eventName === "push" && result.releaseRelevant);
}

/**
 * 比較元を取得できない場合は全検証を実行する。renameの旧パスも評価する。
 * @param {{eventName: string, baseSha: string, headSha: string, cwd?: string}} event
 * @returns {ReturnType<typeof classifyPaths>}
 */
export function classifyGitChange(event) {
  if (event.eventName === "workflow_dispatch") return fullChange();
  if (!/^[0-9a-f]{40}$/i.test(event.headSha)) return fullChange();

  const separator = event.eventName === "pull_request" ? "..." : "..";
  const cwd = event.cwd ?? process.cwd();
  let result = fullChange();
  if (/^[0-9a-f]{40}$/i.test(event.baseSha) && !/^0+$/.test(event.baseSha)) {
    try {
      result = classifyPaths(changedPaths(cwd, `${event.baseSha}${separator}${event.headSha}`));
    } catch {
      // 比較元が取得できない場合は全検証を行い、Release判定だけはTagから算出する。
    }
  }
  if (event.eventName === "push") {
    result.releaseRelevant = classifyReleaseChanges({ cwd, headSha: event.headSha });
  }
  return result;
}

if (process.argv[1]?.endsWith("classify-ci-changes.mjs")) {
  const result = classifyGitChange({
    eventName: process.env.CI_EVENT_NAME ?? "",
    baseSha: process.env.CI_BASE_SHA ?? "",
    headSha: process.env.CI_HEAD_SHA ?? "",
  });
  const output = [
    `code_changed=${result.codeChanged}`,
    `full_ci=${shouldRunFullCi(result, process.env.CI_EVENT_NAME)}`,
    `openapi_changed=${result.openapiChanged}`,
    `workflow_changed=${result.workflowChanged}`,
    `release_relevant=${result.releaseRelevant}`,
  ].join("\n");
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${output}\n`);
  process.stdout.write(`${output}\n`);
}
