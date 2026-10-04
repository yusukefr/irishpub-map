import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const RELEASE_DATE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) JST$/;

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** SemVer release tagを数値として比較します。 */
export function compareReleaseTags(left, right) {
  const leftParts = RELEASE_TAG.exec(left)?.slice(1).map(Number);
  const rightParts = RELEASE_TAG.exec(right)?.slice(1).map(Number);
  if (!leftParts?.every(Number.isSafeInteger) || !rightParts?.every(Number.isSafeInteger)) {
    throw new Error("Invalid release tag.");
  }
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

/** Release Workflowが確定する日時をJSTの分単位へ丸めます。 */
export function formatReleaseDate(now) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const local = `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`;
  return { display: `${local} JST`, iso: `${local.replace(" ", "T")}:00+09:00` };
}

/** 既存annotated tagの日時を再利用し、失敗したDeploymentの再試行で日時を進めません。 */
export function releaseDateFromTag(tag, message) {
  const [heading, date] = message.trim().split("\n");
  if (heading !== `Release ${tag}` || !RELEASE_DATE.test(date ?? "")) {
    throw new Error(`Release tag ${tag} has invalid metadata.`);
  }
  const match = RELEASE_DATE.exec(date);
  const iso = `${match[1]}T${match[2]}:00+09:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime()) || formatReleaseDate(parsed).display !== date) {
    throw new Error(`Release tag ${tag} has an invalid JST date.`);
  }
  return { display: date, iso };
}

/** Tagが別commitを指している場合は、Versionの衝突として停止します。 */
export function assertTagTarget(tag, expectedSha, actualSha) {
  if (actualSha !== expectedSha) throw new Error(`Release tag ${tag} points to a different commit.`);
}

/** Git TagをRelease Versionの正として採番し、同じSHAへの再実行では既存Tagを使います。 */
export function prepareRelease({ cwd = process.cwd(), sha, now = new Date(), outputFile } = {}) {
  if (!/^[0-9a-f]{40}$/i.test(sha ?? "")) throw new Error("A full release commit SHA is required.");
  assertTagTarget("HEAD", sha, git(cwd, "rev-parse", "HEAD"));
  git(cwd, "fetch", "--tags", "origin");

  const tags = git(cwd, "tag", "--list")
    .split("\n")
    .filter((tag) => RELEASE_TAG.test(tag))
    .sort(compareReleaseTags);
  if (tags.length === 0) throw new Error("An annotated baseline release tag is required before the first release.");

  const latest = tags.at(-1);
  const existing = git(cwd, "tag", "--list", "--points-at", sha)
    .split("\n")
    .filter((tag) => RELEASE_TAG.test(tag));
  if (existing.length > 1) throw new Error("Multiple release tags point to the same commit.");

  let version;
  let date;
  if (existing.length === 1) {
    version = existing[0];
    if (version !== latest) throw new Error("A newer release tag already exists; refusing an older release.");
    if (git(cwd, "cat-file", "-t", `refs/tags/${version}`) !== "tag") {
      throw new Error(`Release tag ${version} must be annotated.`);
    }
    assertTagTarget(version, sha, git(cwd, "rev-parse", `${version}^{commit}`));
    date = releaseDateFromTag(version, git(cwd, "for-each-ref", "--format=%(contents)", `refs/tags/${version}`));
  } else {
    if (git(cwd, "cat-file", "-t", `refs/tags/${latest}`) !== "tag") {
      throw new Error(`Release tag ${latest} must be annotated.`);
    }
    const [major, minor, patch] = RELEASE_TAG.exec(latest).slice(1).map(Number);
    if (![major, minor, patch].every(Number.isSafeInteger) || !Number.isSafeInteger(patch + 1)) {
      throw new Error("The latest release version cannot be incremented safely.");
    }
    version = `v${major}.${minor}.${patch + 1}`;
    date = formatReleaseDate(now);
    git(cwd, "tag", "-a", version, "-m", `Release ${version}\n${date.display}`);
    git(cwd, "push", "origin", `refs/tags/${version}`);
  }

  assertTagTarget(version, sha, git(cwd, "rev-parse", `${version}^{commit}`));
  const output = `version=${version}\nreleased_at=${date.iso}\ngit_sha=${sha}\n`;
  if (outputFile) appendFileSync(outputFile, output);
  return { version, releasedAt: date.iso, gitSha: sha };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const release = prepareRelease({ sha: process.env.RELEASE_SHA, outputFile: process.env.GITHUB_OUTPUT });
  console.log(`Prepared ${release.version} for ${release.gitSha}.`);
}
