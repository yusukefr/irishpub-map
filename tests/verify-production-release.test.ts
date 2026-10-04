import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareRelease } from "../scripts/prepare-release.mjs";
import { verifyProductionRelease } from "../scripts/verify-production-release.mjs";

const directories: string[] = [];
const projectId = "prj_example";
const deploymentId = "dpl_example";

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
  const project = {
    id: projectId,
    alias: [
      { target: "PRODUCTION", deployment: { id: deploymentId } },
      { target: "PREVIEW", deployment: { id: "dpl_preview" } },
    ],
  };
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
    expect([`/v9/projects/${projectId}`, `/v13/deployments/${deploymentId}`]).toContain(url.pathname);
    const body = url.pathname === `/v9/projects/${projectId}` ? project : deployment;
    return { ok: true, json: async () => body };
  };
  return { project, deployment, fetchImpl };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("Production release preflight", () => {
  const baseline = { version: "v0.1.64", releasedAt: "2026-10-03T12:00:00+09:00" };

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
      fetchImpl: vercel.fetchImpl,
    };
    delete (vercel.deployment.meta as Partial<typeof vercel.deployment.meta>).releaseDate;
    await expect(verifyProductionRelease(options)).rejects.toThrow("does not match");
    vercel.project.alias.push({ target: "PRODUCTION", deployment: { id: "dpl_other" } });
    await expect(verifyProductionRelease(options)).rejects.toThrow("do not identify one deployment");
    await expect(
      verifyProductionRelease({ ...options, fetchImpl: async () => ({ ok: false, status: 503 }) }),
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
      fetchImpl: vercel.fetchImpl,
    };
    await expect(verifyProductionRelease(options)).resolves.toEqual({ expected: candidate, retry: true });
    writeFileSync(deployedFile, JSON.stringify({ ...candidate, gitSha: "a".repeat(40) }));
    await expect(verifyProductionRelease(options)).rejects.toThrow("Stored deployment marker");
  });
});
