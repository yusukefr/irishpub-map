import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { finalizeRelease } from "../scripts/finalize-release.mjs";
import {
  assertTagTarget,
  compareReleaseTags,
  formatReleaseDate,
  prepareRelease,
  releaseDateFromTag,
} from "../scripts/prepare-release.mjs";

const directories: string[] = [];

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function createRepository() {
  const root = mkdtempSync(join(tmpdir(), "irishpub-release-test-"));
  directories.push(root);
  const remote = join(root, "remote.git");
  const work = join(root, "work");
  git(root, "init", "--bare", "--initial-branch=main", remote);
  git(root, "init", "--initial-branch=main", work);
  git(work, "config", "user.name", "Release Test");
  git(work, "config", "user.email", "release-test@localhost");
  writeFileSync(join(work, "marker.txt"), "baseline\n");
  git(work, "add", "marker.txt");
  git(work, "commit", "-m", "baseline");
  git(work, "remote", "add", "origin", remote);
  git(work, "push", "-u", "origin", "main");
  return work;
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("prepare-release", () => {
  it("creates no tag before deployment and finalizes the same metadata after success", () => {
    const work = createRepository();
    git(work, "tag", "-a", "v0.1.64", "-m", "Release v0.1.64\n2026-10-03 12:00 JST");
    git(work, "push", "origin", "refs/tags/v0.1.64");
    writeFileSync(join(work, "marker.txt"), "next release\n");
    git(work, "commit", "-am", "next release");
    const sha = git(work, "rev-parse", "HEAD");
    git(work, "push", "origin", "main");

    const metadataFile = join(work, "release-metadata.json");
    const deployedFile = join(work, "release-deployed.json");
    const first = prepareRelease({ cwd: work, sha, now: new Date("2026-10-04T03:42:59Z"), metadataFile });
    const retry = prepareRelease({ cwd: work, sha, now: new Date("2026-10-05T03:42:00Z"), metadataFile });

    expect(first).toEqual({ version: "v0.1.65", releasedAt: "2026-10-04T12:42:00+09:00", gitSha: sha });
    expect(retry).toEqual(first);
    expect(git(work, "tag", "--list", "v*")).toBe("v0.1.64");
    expect(() => finalizeRelease({ cwd: work, sha, metadataFile, deployedFile })).toThrow("ENOENT");
    expect(git(work, "tag", "--list", "v*")).toBe("v0.1.64");

    copyFileSync(metadataFile, deployedFile);
    expect(finalizeRelease({ cwd: work, sha, metadataFile, deployedFile })).toEqual(first);
    expect(finalizeRelease({ cwd: work, sha, metadataFile, deployedFile })).toEqual(first);
    expect(git(work, "rev-parse", "v0.1.65^{commit}")).toBe(sha);
    expect(git(work, "tag", "--list", "v*").split("\n")).toEqual(["v0.1.64", "v0.1.65"]);
  });

  it("can push the same tag after a post-deployment push failure", () => {
    const work = createRepository();
    git(work, "tag", "-a", "v0.1.64", "-m", "Release v0.1.64\n2026-10-03 12:00 JST");
    git(work, "push", "origin", "refs/tags/v0.1.64");
    writeFileSync(join(work, "marker.txt"), "next release\n");
    git(work, "commit", "-am", "next release");
    const sha = git(work, "rev-parse", "HEAD");
    const metadataFile = join(work, "release-metadata.json");
    const deployedFile = join(work, "release-deployed.json");
    const release = prepareRelease({ cwd: work, sha, metadataFile });
    copyFileSync(metadataFile, deployedFile);

    const hook = join(work, "..", "remote.git", "hooks", "pre-receive");
    writeFileSync(hook, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    expect(() => finalizeRelease({ cwd: work, sha, metadataFile, deployedFile })).toThrow();
    expect(git(work, "ls-remote", "--tags", "origin", "refs/tags/v0.1.65")).toBe("");

    rmSync(hook);
    expect(finalizeRelease({ cwd: work, sha, metadataFile, deployedFile })).toEqual(release);
    expect(git(work, "ls-remote", "--tags", "origin", "refs/tags/v0.1.65^{}")).toContain(sha);
    expect(existsSync(metadataFile)).toBe(true);
  });

  it("refuses to release without an annotated baseline tag", () => {
    const work = createRepository();
    const sha = git(work, "rev-parse", "HEAD");
    expect(() => prepareRelease({ cwd: work, sha })).toThrow("baseline release tag");
  });

  it("refuses a mismatched deployment marker and another tag on the release commit", () => {
    const work = createRepository();
    git(work, "tag", "-a", "v0.1.64", "-m", "Release v0.1.64\n2026-10-03 12:00 JST");
    git(work, "push", "origin", "refs/tags/v0.1.64");
    writeFileSync(join(work, "marker.txt"), "next release\n");
    git(work, "commit", "-am", "next release");
    const sha = git(work, "rev-parse", "HEAD");
    const metadataFile = join(work, "release-metadata.json");
    const deployedFile = join(work, "release-deployed.json");
    const candidate = prepareRelease({ cwd: work, sha, metadataFile });
    writeFileSync(deployedFile, `${JSON.stringify({ ...candidate, releasedAt: "2026-10-05T12:42:00+09:00" })}\n`);
    expect(() => finalizeRelease({ cwd: work, sha, metadataFile, deployedFile })).toThrow("Deployment marker");
    copyFileSync(metadataFile, deployedFile);
    git(work, "tag", "-a", "v0.1.66", "-m", "Release v0.1.66\n2026-10-04 12:42 JST");
    expect(() => finalizeRelease({ cwd: work, sha, metadataFile, deployedFile })).toThrow("different release tag");
  });

  it("rejects another SHA, invalid tag metadata, and orders versions numerically", () => {
    expect(() => assertTagTarget("v0.1.65", "a".repeat(40), "b".repeat(40))).toThrow("different commit");
    expect(() => releaseDateFromTag("v0.1.65", "Release v0.1.65\n2026-02-30 12:42 JST")).toThrow("invalid JST date");
    expect(compareReleaseTags("v0.1.10", "v0.1.9")).toBeGreaterThan(0);
    expect(formatReleaseDate(new Date("2026-10-03T15:00:45Z"))).toEqual({
      display: "2026-10-04 00:00 JST",
      iso: "2026-10-04T00:00:00+09:00",
    });
  });
});
