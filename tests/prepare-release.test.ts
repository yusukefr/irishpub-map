import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
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
  it("increments the baseline tag and reuses its version and date on retry", () => {
    const work = createRepository();
    git(work, "tag", "-a", "v0.1.64", "-m", "Release v0.1.64\n2026-10-03 12:00 JST");
    git(work, "push", "origin", "refs/tags/v0.1.64");
    writeFileSync(join(work, "marker.txt"), "next release\n");
    git(work, "commit", "-am", "next release");
    const sha = git(work, "rev-parse", "HEAD");
    git(work, "push", "origin", "main");

    const first = prepareRelease({ cwd: work, sha, now: new Date("2026-10-04T03:42:59Z") });
    const retry = prepareRelease({ cwd: work, sha, now: new Date("2026-10-05T03:42:00Z") });

    expect(first).toEqual({ version: "v0.1.65", releasedAt: "2026-10-04T12:42:00+09:00", gitSha: sha });
    expect(retry).toEqual(first);
    expect(git(work, "rev-parse", "v0.1.65^{commit}")).toBe(sha);
    expect(git(work, "tag", "--list", "v*").split("\n")).toEqual(["v0.1.64", "v0.1.65"]);
  });

  it("refuses to release without an annotated baseline tag", () => {
    const work = createRepository();
    const sha = git(work, "rev-parse", "HEAD");
    expect(() => prepareRelease({ cwd: work, sha })).toThrow("baseline release tag");
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
