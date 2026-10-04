import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { compareReleaseTags, nextPatchTag, readReleaseMetadata, releaseDateFromTag } from "./prepare-release.mjs";

const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** 最新のannotated TagのVersion・日時・対象SHAをProductionとの照合値にします。 */
export function latestTaggedRelease(cwd) {
  git(cwd, "fetch", "--tags", "origin");
  const tags = git(cwd, "tag", "--list")
    .split("\n")
    .filter((tag) => RELEASE_TAG.test(tag))
    .sort(compareReleaseTags);
  const version = tags.at(-1);
  if (!version) throw new Error("An annotated baseline release tag is required.");
  if (git(cwd, "cat-file", "-t", `refs/tags/${version}`) !== "tag") {
    throw new Error(`Release tag ${version} must be annotated.`);
  }
  const message = git(cwd, "for-each-ref", "--format=%(contents)", `refs/tags/${version}`);
  return {
    version,
    releasedAt: releaseDateFromTag(version, message).iso,
    gitSha: git(cwd, "rev-parse", `${version}^{commit}`),
  };
}

/** ProjectのProduction aliasが同じDeploymentを指す場合だけ採用します。 */
export function currentProductionDeploymentId(project, projectId) {
  if (project?.id !== projectId || !Array.isArray(project.alias)) {
    throw new Error("Cannot identify the Vercel Production project aliases.");
  }
  const aliases = project.alias.filter(
    (alias) => alias?.target === "PRODUCTION" && !alias.gitBranch && !alias.redirect,
  );
  const ids = aliases.map((alias) => alias.deployment?.id ?? alias.deploymentId);
  if (ids.length === 0 || ids.some((id) => typeof id !== "string" || !id) || new Set(ids).size !== 1) {
    throw new Error("Production aliases do not identify one deployment.");
  }
  return ids[0];
}

/** 現行ProductionのDeployment metadataをRelease値と厳密に照合します。 */
export function assertProductionMatches(deployment, deploymentId, expected) {
  if (
    deployment?.id !== deploymentId ||
    deployment.readyState !== "READY" ||
    deployment.target !== "production" ||
    deployment.meta?.releaseVersion !== expected.version ||
    deployment.meta?.releaseDate !== expected.releasedAt ||
    deployment.meta?.releaseGitSha !== expected.gitSha
  ) {
    throw new Error("Current Production deployment does not match the expected release metadata.");
  }
}

async function vercelJson(path, { token, orgId, fetchImpl }) {
  const url = new URL(`https://api.vercel.com${path}`);
  if (orgId.startsWith("team_")) url.searchParams.set("teamId", orgId);
  // Response本文にcredentialやProject情報が含まれる可能性があるため、エラーでは出力しません。
  const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Vercel API request failed (${response.status}).`);
  return response.json();
}

/** 新規Releaseは最新Tag、Tag push再試行は保存済み候補と現行Productionを照合します。 */
export async function verifyProductionRelease({
  cwd = process.cwd(),
  sha,
  metadataFile,
  deployedFile,
  token,
  orgId,
  projectId,
  fetchImpl = fetch,
} = {}) {
  if (!/^[0-9a-f]{40}$/i.test(sha ?? "") || !token || !orgId || !projectId) {
    throw new Error("Release SHA and Vercel credentials are required.");
  }
  if (git(cwd, "rev-parse", "HEAD") !== sha) throw new Error("Release SHA does not match HEAD.");
  const latest = latestTaggedRelease(cwd);
  const retry = Boolean(deployedFile && existsSync(deployedFile));
  if (retry && (!metadataFile || !existsSync(metadataFile))) {
    throw new Error("Deployment marker exists without release metadata.");
  }
  const expected = retry ? readReleaseMetadata(metadataFile) : latest;
  if (retry) {
    const deployed = readReleaseMetadata(deployedFile);
    if (
      JSON.stringify(expected) !== JSON.stringify(deployed) ||
      expected.gitSha !== sha ||
      expected.version !== nextPatchTag(latest.version)
    ) {
      throw new Error("Stored deployment marker does not match the next release candidate.");
    }
  }
  const options = { token, orgId, fetchImpl };
  const project = await vercelJson(`/v9/projects/${encodeURIComponent(projectId)}`, options);
  const deploymentId = currentProductionDeploymentId(project, projectId);
  const deployment = await vercelJson(`/v13/deployments/${encodeURIComponent(deploymentId)}`, options);
  assertProductionMatches(deployment, deploymentId, expected);
  return { expected, retry };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await verifyProductionRelease({
    sha: process.env.RELEASE_SHA,
    metadataFile: process.env.RELEASE_METADATA_FILE,
    deployedFile: process.env.RELEASE_DEPLOYED_FILE,
    token: process.env.VERCEL_TOKEN,
    orgId: process.env.VERCEL_ORG_ID,
    projectId: process.env.VERCEL_PROJECT_ID,
  });
  console.log(`Verified current Production for ${result.expected.version}.`);
}
