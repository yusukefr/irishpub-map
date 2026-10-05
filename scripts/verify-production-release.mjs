import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
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
    hostnames.length < 1 ||
    new Set(hostnames).size !== hostnames.length ||
    hostnames.some((hostname) => !validHostname(hostname))
  ) {
    throw new Error("At least one distinct Production hostname is required.");
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

/**
 * 各hostnameのAliasを検証し、Project内の参照先Deployment IDを個別に返します。
 * @param {string[]} hostnames 設定済みのProduction hostname。
 * @param {string} projectId 対象Project ID。
 * @param {object} options Vercel APIの認証とfetch実装。
 * @returns {Promise<Record<string, string>>} hostnameごとのDeployment ID。
 */
export async function resolveProductionDeployments(hostnames, projectId, options) {
  const entries = await Promise.all(
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
      return [hostname, alias.deploymentId];
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * deploy前に全hostnameが同じProject/Deploymentを指すことを要求します。
 * @param {string[]} hostnames 設定済みのProduction hostname。
 * @param {string} projectId 対象Project ID。
 * @param {object} options Vercel APIの認証とfetch実装。
 * @returns {Promise<string>} 全hostnameが指すDeployment ID。
 */
export async function currentProductionDeploymentId(hostnames, projectId, options) {
  const ids = Object.values(await resolveProductionDeployments(hostnames, projectId, options));
  if (new Set(ids).size !== 1) throw new Error("Production hostnames point to different deployments.");
  return ids[0];
}

function vercelOptions({ token, orgId, projectId, hostnames, fetchImpl }) {
  if (!token || !orgId || !projectId) throw new Error("Vercel credentials are required.");
  return { options: { token, orgId, fetchImpl }, productionHostnames: parseProductionHostnames(hostnames) };
}

/**
 * 旧Deploymentとcandidateへの参照が混在する間、全hostnameの切替を待ちます。
 * 第三のDeployment・API失敗・metadata不一致は再試行せず、marker作成前に停止します。
 * @param {object} options 検証対象と待機条件。now/sleepは時間を進めるテストで差し替えます。
 * @returns {Promise<object>} 公開を確認したRelease metadataとDeployment ID。
 */
export async function waitForPublishedCandidate({
  previousDeploymentId,
  candidateId,
  expected,
  token,
  orgId,
  projectId,
  hostnames,
  fetchImpl = fetch,
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs = 90_000,
  intervalMs = 5_000,
} = {}) {
  if (typeof candidateId !== "string" || !candidateId) throw new Error("Candidate deployment ID is required.");
  if (typeof previousDeploymentId !== "string" || !previousDeploymentId || previousDeploymentId === candidateId) {
    throw new Error("A distinct previous deployment ID is required.");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || !Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("Invalid Production hostname polling interval or timeout.");
  }
  const { options, productionHostnames } = vercelOptions({ token, orgId, projectId, hostnames, fetchImpl });
  const deadline = now() + timeoutMs;
  while (true) {
    const deploymentIds = Object.values(await resolveProductionDeployments(productionHostnames, projectId, options));
    if (deploymentIds.some((id) => id !== previousDeploymentId && id !== candidateId)) {
      throw new Error("Production hostname points to an unexpected deployment.");
    }
    if (deploymentIds.every((id) => id === candidateId)) {
      const current = await vercelJson(`/v13/deployments/${encodeURIComponent(candidateId)}`, options);
      assertProductionMatches(current, candidateId, expected);
      return { expected, deploymentId: candidateId };
    }
    const remaining = deadline - now();
    if (remaining <= 0) throw new Error("Production hostnames did not switch to the candidate before timeout.");
    await sleep(Math.min(intervalMs, remaining));
  }
}

/**
 * 新規Releaseは最新Tag、再試行は保存済み候補と現行Productionを照合します。
 * metadata保存後・marker保存前にProduction公開だけ成功した場合は、candidateを復旧対象として返します。
 */
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
  const hasMetadata = Boolean(metadataFile && existsSync(metadataFile));
  const retry = Boolean(deployedFile && existsSync(deployedFile));
  if (retry && !hasMetadata) {
    throw new Error("Deployment marker exists without release metadata.");
  }

  const candidate = hasMetadata ? readReleaseMetadata(metadataFile) : null;
  if (candidate && (candidate.gitSha !== sha || candidate.version !== nextPatchTag(latest.version))) {
    throw new Error("Stored release metadata does not match the next release candidate.");
  }
  if (retry) {
    const deployed = readReleaseMetadata(deployedFile);
    if (JSON.stringify(candidate) !== JSON.stringify(deployed)) {
      throw new Error("Stored deployment marker does not match the next release candidate.");
    }
  }

  const { options, productionHostnames } = vercelOptions({ token, orgId, projectId, hostnames, fetchImpl });
  const deploymentId = await currentProductionDeploymentId(productionHostnames, projectId, options);
  const deployment = await vercelJson(`/v13/deployments/${encodeURIComponent(deploymentId)}`, options);

  if (retry) {
    assertProductionMatches(deployment, deploymentId, candidate);
    return { expected: candidate, retry: true, recovered: false, previousDeploymentId: deploymentId };
  }

  if (candidate) {
    try {
      assertProductionMatches(deployment, deploymentId, candidate);
      return { expected: candidate, retry: false, recovered: true, previousDeploymentId: deploymentId };
    } catch {
      // Productionがまだlatest Tagなら、保存済みcandidateを同じVersion/日時で再deployできます。
    }
  }

  assertProductionMatches(deployment, deploymentId, latest);
  return { expected: latest, retry: false, recovered: false, previousDeploymentId: deploymentId };
}

/** CandidateのREADY状態と、保存済み旧IDからのProduction公開を確認してからmarkerを許可します。 */
export async function verifyPublishedCandidate({
  sha,
  metadataFile,
  candidateDeploymentFile,
  previousDeploymentId,
  token,
  orgId,
  projectId,
  hostnames,
  fetchImpl = fetch,
  now,
  sleep,
  timeoutMs,
  intervalMs,
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
  const { options } = vercelOptions({ token, orgId, projectId, hostnames, fetchImpl });
  const candidate = await vercelJson(`/v13/deployments/${encodeURIComponent(candidateUrl.hostname)}`, options);
  if (typeof candidate?.id !== "string" || !candidate.id) throw new Error("Candidate deployment ID is missing.");
  assertProductionMatches(candidate, candidate.id, expected);
  return waitForPublishedCandidate({
    previousDeploymentId,
    candidateId: candidate.id,
    expected,
    token,
    orgId,
    projectId,
    hostnames,
    fetchImpl,
    now,
    sleep,
    timeoutMs,
    intervalMs,
  });
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
  let result;
  if (process.env.CANDIDATE_DEPLOYMENT_FILE) {
    if (!process.env.PREVIOUS_DEPLOYMENT_FILE || !existsSync(process.env.PREVIOUS_DEPLOYMENT_FILE)) {
      throw new Error("Previous deployment ID file is required.");
    }
    result = await verifyPublishedCandidate({
      ...common,
      candidateDeploymentFile: process.env.CANDIDATE_DEPLOYMENT_FILE,
      previousDeploymentId: readFileSync(process.env.PREVIOUS_DEPLOYMENT_FILE, "utf8").trim(),
    });
  } else {
    result = await verifyProductionRelease({ ...common, deployedFile: process.env.RELEASE_DEPLOYED_FILE });
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `recovered=${result.recovered ? "true" : "false"}\n`);
    }
    if (process.env.PREVIOUS_DEPLOYMENT_FILE) {
      writeFileSync(process.env.PREVIOUS_DEPLOYMENT_FILE, result.previousDeploymentId, { flag: "wx", mode: 0o600 });
    }
  }
  console.log(`Verified current Production for ${result.expected.version}.`);
}
