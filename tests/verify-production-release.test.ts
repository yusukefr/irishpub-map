import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareRelease } from "../scripts/prepare-release.mjs";
import {
  parseProductionHostnames,
  verifyProductionRelease,
  verifyPublishedCandidate,
} from "../scripts/verify-production-release.mjs";

const directories: string[] = [];
const projectId = "prj_example";
const deploymentId = "dpl_example";
const hostnames = "production.example.com,production-team.example.com,production-branch.example.com";
const hostnameList = hostnames.split(",");
const candidateHostname = "candidate.example.vercel.app";

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function createRepository() {
  const root = mkdtempSync(join(tmpdir(), "irishpub-production-release-test-"));
  directories.push(root);
  const work = join(root, "work");
  git(root, "init", "--bare", "--initial-branch=main", join(root, "remote.git"));
  git(root, "init", "--initial-branch=main", work);
  git(work, "config", "user.name", "Release Test");
  git(work, "config", "user.email", "release-test@localhost");
  git(work, "commit", "--allow-empty", "-m", "baseline");
  git(work, "tag", "-a", "v0.1.64", "-m", "Release v0.1.64\n2026-10-03 12:00 JST");
  git(work, "remote", "add", "origin", join(root, "remote.git"));
  git(work, "push", "origin", "main", "refs/tags/v0.1.64");
  git(work, "commit", "--allow-empty", "-m", "next release");
  return { work, sha: git(work, "rev-parse", "HEAD"), baselineSha: git(work, "rev-parse", "v0.1.64^{commit}") };
}

function fakeVercel(expected: { version: string; releasedAt: string; gitSha: string }) {
  const aliases = Object.fromEntries(
    hostnameList.map((hostname) => [
      hostname,
      { alias: hostname, projectId, deploymentId, deployment: { id: deploymentId } },
    ]),
  );
  const deployment = {
    id: deploymentId,
    readyState: "READY",
    target: "production",
    meta: {
      releaseVersion: expected.version,
      releaseDate: expected.releasedAt,
      releaseGitSha: expected.gitSha,
    },
  };
  const fetchImpl = async (url: URL, options: { headers: { Authorization: string } }) => {
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(url.searchParams.get("teamId")).toBe("team_example");
    let body;
    if (url.pathname.startsWith("/v4/aliases/")) {
      expect(url.searchParams.get("projectId")).toBe(projectId);
      body = aliases[decodeURIComponent(url.pathname.split("/").at(-1) ?? "")];
    } else {
      expect([`/v13/deployments/${deploymentId}`, `/v13/deployments/${candidateHostname}`]).toContain(url.pathname);
      body = deployment;
    }
    return { ok: true, json: async () => body };
  };
  return { aliases, deployment, fetchImpl };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("Production release preflight", () => {
  const baseline = { version: "v0.1.64", releasedAt: "2026-10-03T12:00:00+09:00" };

  it("requires three distinct Production hostnames", () => {
    expect(parseProductionHostnames(hostnames)).toEqual(hostnameList);
    expect(() => parseProductionHostnames("production.example.com,production.example.com")).toThrow("three distinct");
    expect(() => parseProductionHostnames("https://production.example.com")).toThrow("three distinct");
  });

  it("accepts a new release only when current Production matches the latest annotated tag", async () => {
    const { work, sha, baselineSha } = createRepository();
    const vercel = fakeVercel({ ...baseline, gitSha: baselineSha });
    await expect(
      verifyProductionRelease({
        cwd: work,
        sha,
        token: "test-token",
        orgId: "team_example",
        projectId,
        hostnames,
        fetchImpl: vercel.fetchImpl,
      }),
    ).resolves.toEqual({ expected: { ...baseline, gitSha: baselineSha }, retry: false });
  });

  it.each(["releaseVersion", "releaseDate", "releaseGitSha"])(
    "stops when current Production %s differs from the latest tag",
    async (field) => {
      const { work, sha, baselineSha } = createRepository();
      const vercel = fakeVercel({ ...baseline, gitSha: baselineSha });
      vercel.deployment.meta[field as keyof typeof vercel.deployment.meta] = "mismatch";
      await expect(
        verifyProductionRelease({
          cwd: work,
          sha,
          token: "test-token",
          orgId: "team_example",
          projectId,
          hostnames,
          fetchImpl: vercel.fetchImpl,
        }),
      ).rejects.toThrow("does not match");
    },
  );

  it("stops for missing metadata, split aliases, and API failures", async () => {
    const { work, sha, baselineSha } = createRepository();
    const vercel = fakeVercel({ ...baseline, gitSha: baselineSha });
    const options = {
      cwd: work,
      sha,
      token: "test-token",
      orgId: "team_example",
      projectId,
      hostnames,
      fetchImpl: vercel.fetchImpl,
    };
    delete (vercel.deployment.meta as Partial<typeof vercel.deployment.meta>).releaseDate;
    await expect(verifyProductionRelease(options)).rejects.toThrow("does not match");
    vercel.aliases[hostnameList[2]].deploymentId = "dpl_other";
    vercel.aliases[hostnameList[2]].deployment.id = "dpl_other";
    await expect(verifyProductionRelease(options)).rejects.toThrow("different deployments");
    vercel.aliases[hostnameList[2]].deploymentId = deploymentId;
    vercel.aliases[hostnameList[2]].deployment.id = deploymentId;
    await expect(
      verifyProductionRelease({
        ...options,
        fetchImpl: async (url: URL, request: { headers: { Authorization: string } }) =>
          url.pathname.startsWith("/v13/deployments/") ? { ok: false, status: 503 } : vercel.fetchImpl(url, request),
      }),
    ).rejects.toThrow("Vercel API request failed");
  });

  it("uses saved candidate only for a matching deployment marker on a tag push retry", async () => {
    const { work, sha } = createRepository();
    const metadataFile = join(work, "release-metadata.json");
    const deployedFile = join(work, "release-deployed.json");
    const candidate = prepareRelease({ cwd: work, sha, now: new Date("2026-10-04T03:42:00Z"), metadataFile });
    copyFileSync(metadataFile, deployedFile);
    const vercel = fakeVercel(candidate);
    const options = {
      cwd: work,
      sha,
      metadataFile,
      deployedFile,
      token: "test-token",
      orgId: "team_example",
      projectId,
      hostnames,
      fetchImpl: vercel.fetchImpl,
    };
    await expect(verifyProductionRelease(options)).resolves.toEqual({ expected: candidate, retry: true });
    writeFileSync(deployedFile, JSON.stringify({ ...candidate, gitSha: "a".repeat(40) }));
    await expect(verifyProductionRelease(options)).rejects.toThrow("Stored deployment marker");
  });

  it("confirms the candidate is READY and all Production hostnames point to its deployment before marking success", async () => {
    const { work, sha } = createRepository();
    const metadataFile = join(work, "release-metadata.json");
    const candidateDeploymentFile = join(work, "candidate-url.txt");
    const candidate = prepareRelease({ cwd: work, sha, now: new Date("2026-10-04T03:42:00Z"), metadataFile });
    writeFileSync(candidateDeploymentFile, `https://${candidateHostname}\n`);
    const vercel = fakeVercel(candidate);
    const options = {
      sha,
      metadataFile,
      candidateDeploymentFile,
      token: "test-token",
      orgId: "team_example",
      projectId,
      hostnames,
      fetchImpl: vercel.fetchImpl,
    };
    await expect(verifyPublishedCandidate(options)).resolves.toEqual({ expected: candidate, deploymentId });

    vercel.deployment.readyState = "ERROR";
    await expect(verifyPublishedCandidate(options)).rejects.toThrow("does not match");
    vercel.deployment.readyState = "READY";
    vercel.deployment.meta.releaseDate = "mismatch";
    await expect(verifyPublishedCandidate(options)).rejects.toThrow("does not match");
    vercel.deployment.meta.releaseDate = candidate.releasedAt;

    vercel.aliases[hostnameList[0]].deploymentId = "dpl_other";
    vercel.aliases[hostnameList[0]].deployment.id = "dpl_other";
    await expect(verifyPublishedCandidate(options)).rejects.toThrow("different deployments");

    for (const alias of Object.values(vercel.aliases)) {
      alias.deploymentId = "dpl_previous";
      alias.deployment.id = "dpl_previous";
    }
    await expect(verifyPublishedCandidate(options)).rejects.toThrow("do not point to the candidate");
  });
});
