import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  assertTagTarget,
  compareReleaseTags,
  nextPatchTag,
  readReleaseMetadata,
  releaseDateFromTag,
} from "./prepare-release.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Production成功markerと候補metadataが一致する場合だけannotated Tagを確定します。 */
export function finalizeRelease({ cwd = process.cwd(), sha, metadataFile, deployedFile } = {}) {
  if (!metadataFile || !deployedFile) throw new Error("Release metadata and deployment marker are required.");
  const release = readReleaseMetadata(metadataFile);
  const deployed = readReleaseMetadata(deployedFile);
  if (JSON.stringify(release) !== JSON.stringify(deployed))
    throw new Error("Deployment marker does not match release metadata.");
  if (sha && sha !== release.gitSha) throw new Error("Release SHA does not match the deployment metadata.");
  assertTagTarget("HEAD", release.gitSha, git(cwd, "rev-parse", "HEAD"));
  git(cwd, "fetch", "--tags", "origin");

  const tags = git(cwd, "tag", "--list")
    .split("\n")
    .filter((tag) => /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag))
    .sort(compareReleaseTags);
  if (tags.length === 0) throw new Error("An annotated baseline release tag is required.");

  const latest = tags.at(-1);
  const tagExists = tags.includes(release.version);
  const tagsAtCommit = git(cwd, "tag", "--list", "--points-at", release.gitSha)
    .split("\n")
    .filter((tag) => /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag));
  if (tagsAtCommit.some((tag) => tag !== release.version)) {
    throw new Error("A different release tag already points to this commit.");
  }
  if (tagExists) {
    if (latest !== release.version) throw new Error("A newer release tag already exists.");
    if (git(cwd, "cat-file", "-t", `refs/tags/${release.version}`) !== "tag") {
      throw new Error(`Release tag ${release.version} must be annotated.`);
    }
    assertTagTarget(release.version, release.gitSha, git(cwd, "rev-parse", `${release.version}^{commit}`));
    const taggedDate = releaseDateFromTag(
      release.version,
      git(cwd, "for-each-ref", "--format=%(contents)", `refs/tags/${release.version}`),
    );
    if (taggedDate.iso !== release.releasedAt) throw new Error("Release tag date does not match deployment metadata.");
  } else {
    if (git(cwd, "cat-file", "-t", `refs/tags/${latest}`) !== "tag") {
      throw new Error(`Release tag ${latest} must be annotated.`);
    }
    if (nextPatchTag(latest) !== release.version) throw new Error("Release version is not the next patch tag.");
    const display = `${release.releasedAt.slice(0, 10)} ${release.releasedAt.slice(11, 16)} JST`;
    git(cwd, "tag", "-a", release.version, release.gitSha, "-m", `Release ${release.version}\n${display}`);
  }

  git(cwd, "push", "origin", `refs/tags/${release.version}`);
  const remote = git(cwd, "ls-remote", "--tags", "origin", `refs/tags/${release.version}^{}`).split("\t")[0];
  assertTagTarget(release.version, release.gitSha, remote);
  return release;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const release = finalizeRelease({
    sha: process.env.RELEASE_SHA,
    metadataFile: process.env.RELEASE_METADATA_FILE,
    deployedFile: process.env.RELEASE_DEPLOYED_FILE,
  });
  console.log(`Finalized ${release.version} for ${release.gitSha}.`);
}
