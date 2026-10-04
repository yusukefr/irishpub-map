import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { compareReleaseTags, nextPatchTag, readReleaseMetadata, releaseDateFromTag } from "./prepare-release.mjs";

const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function validHostname(hostname) {
  const labels = hostname.split(".");
  return labels.length >= 2 && labels.every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
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

/** 設定済みのProduction hostnameを重複・不正な値を拒否して読みます。 */
export function parseProductionHostnames(value) {
  const hostnames =
    value
      ?.split(/[\n,]/)
      .map((hostname) => hostname.trim())
      .filter(Boolean) ?? [];
  if (
    hostnames.length < 3 ||
    new Set(hostnames).size !== hostnames.length ||
    hostnames.some((hostname) => !validHostname(hostname))
  ) {
    throw new Error("At least three distinct Production hostnames are required.");
  }
  return hostnames;
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

/** 各hostnameを実際のAlias APIで解決し、全てが同じProject/Deploymentを指すことを要求します。 */
export async function currentProductionDeploymentId(hostnames, projectId, options) {
  const ids = await Promise.all(
    hostnames.map(async (hostname) => {
      const alias = await vercelJson(
        `/v4/aliases/${encodeURIComponent(hostname)}?projectId=${encodeURIComponent(projectId)}`,
        options,
      );
      if (
        alias?.alias !== hostname ||
        alias.projectId !== projectId ||
        alias.redirect ||
        typeof alias.deploymentId !== "string" ||
        !alias.deploymentId ||
        (alias.deployment?.id && alias.deployment.id !== alias.deploymentId)
      ) {
        throw new Error("Production hostname could not be resolved to the expected project deployment.");
      }
      return alias.deploymentId;
    }),
  );
  if (new Set(ids).size !== 1) throw new Error("Production hostnames point to different deployments.");
  return ids[0];
}

function vercelOptions({ token, orgId, projectId, hostnames, fetchImpl }) {
  if (!token || !orgId || !projectId) throw new Error("Vercel credentials are required.");
  return { options: { token, orgId, fetchImpl }, productionHostnames: parseProductionHostnames(hostnames) };
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
  hostnames,
  fetchImpl = fetch,
} = {}) {
  if (!/^[0-9a-f]{40}$/i.test(sha ?? "")) throw new Error("A full release SHA is required.");
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
  const { options, productionHostnames } = vercelOptions({ token, orgId, projectId, hostnames, fetchImpl });
  const deploymentId = await currentProductionDeploymentId(productionHostnames, projectId, options);
  const deployment = await vercelJson(`/v13/deployments/${encodeURIComponent(deploymentId)}`, options);
  assertProductionMatches(deployment, deploymentId, expected);
  return { expected, retry };
}

/** CandidateのREADY状態と現行Production hostnameへの公開を確認してからmarkerを許可します。 */
export async function verifyPublishedCandidate({
  sha,
  metadataFile,
  candidateDeploymentFile,
  token,
  orgId,
  projectId,
  hostnames,
  fetchImpl = fetch,
} = {}) {
  if (!metadataFile || !candidateDeploymentFile) throw new Error("Candidate metadata and deployment URL are required.");
  const expected = readReleaseMetadata(metadataFile);
  if (expected.gitSha !== sha) throw new Error("Candidate SHA does not match the release commit.");
  const candidateUrl = new URL(readFileSync(candidateDeploymentFile, "utf8").trim());
  if (
    candidateUrl.protocol !== "https:" ||
    candidateUrl.pathname !== "/" ||
    candidateUrl.search ||
    candidateUrl.hash ||
    candidateUrl.username ||
    candidateUrl.password ||
    candidateUrl.port ||
    !validHostname(candidateUrl.hostname)
  ) {
    throw new Error("Invalid candidate deployment URL.");
  }
  const { options, productionHostnames } = vercelOptions({ token, orgId, projectId, hostnames, fetchImpl });
  const candidate = await vercelJson(`/v13/deployments/${encodeURIComponent(candidateUrl.hostname)}`, options);
  if (typeof candidate?.id !== "string" || !candidate.id) throw new Error("Candidate deployment ID is missing.");
  assertProductionMatches(candidate, candidate.id, expected);
  const deploymentId = await currentProductionDeploymentId(productionHostnames, projectId, options);
  if (deploymentId !== candidate.id) throw new Error("Production hostnames do not point to the candidate deployment.");
  const current = await vercelJson(`/v13/deployments/${encodeURIComponent(deploymentId)}`, options);
  assertProductionMatches(current, deploymentId, expected);
  return { expected, deploymentId };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const common = {
    sha: process.env.RELEASE_SHA,
    metadataFile: process.env.RELEASE_METADATA_FILE,
    token: process.env.VERCEL_TOKEN,
    orgId: process.env.VERCEL_ORG_ID,
    projectId: process.env.VERCEL_PROJECT_ID,
    hostnames: process.env.VERCEL_PRODUCTION_HOSTNAMES,
  };
  const result = process.env.CANDIDATE_DEPLOYMENT_FILE
    ? await verifyPublishedCandidate({ ...common, candidateDeploymentFile: process.env.CANDIDATE_DEPLOYMENT_FILE })
    : await verifyProductionRelease({ ...common, deployedFile: process.env.RELEASE_DEPLOYED_FILE });
  console.log(`Verified current Production for ${result.expected.version}.`);
}
