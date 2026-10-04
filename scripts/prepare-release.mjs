import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
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

/** 最新Tagから次のpatch Versionを決めます。 */
export function nextPatchTag(latest) {
  const parts = RELEASE_TAG.exec(latest)?.slice(1).map(Number);
  if (!parts?.every(Number.isSafeInteger) || !Number.isSafeInteger(parts[2] + 1)) {
    throw new Error("The latest release version cannot be incremented safely.");
  }
  return `v${parts[0]}.${parts[1]}.${parts[2] + 1}`;
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

/** Artifactから候補metadataを読み、日時・Version・full SHAを検証します。 */
export function readReleaseMetadata(metadataFile) {
  const release = JSON.parse(readFileSync(metadataFile, "utf8"));
  if (
    !RELEASE_TAG.test(release.version) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$/.test(release.releasedAt) ||
    !/^[0-9a-f]{40}$/i.test(release.gitSha)
  ) {
    throw new Error("Invalid release metadata.");
  }
  const display = `${release.releasedAt.slice(0, 10)} ${release.releasedAt.slice(11, 16)} JST`;
  if (releaseDateFromTag(release.version, `Release ${release.version}\n${display}`).iso !== release.releasedAt) {
    throw new Error("Invalid release date.");
  }
  return { version: release.version, releasedAt: release.releasedAt, gitSha: release.gitSha };
}

/** Tagを作成せずRelease候補を確定し、同じWorkflow runではartifactのmetadataを再利用します。 */
export function prepareRelease({ cwd = process.cwd(), sha, now = new Date(), outputFile, metadataFile } = {}) {
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
    version = nextPatchTag(latest);
    date = formatReleaseDate(now);
  }

  const candidate = { version, releasedAt: date.iso, gitSha: sha };
  const release = metadataFile && existsSync(metadataFile) ? readReleaseMetadata(metadataFile) : candidate;
  if (
    release.version !== candidate.version ||
    release.gitSha !== sha ||
    (existing.length && release.releasedAt !== date.iso)
  ) {
    throw new Error("Stored release metadata does not match the current release candidate.");
  }
  if (metadataFile && !existsSync(metadataFile))
    writeFileSync(metadataFile, `${JSON.stringify(release)}\n`, { flag: "wx" });
  const output = `version=${release.version}\nreleased_at=${release.releasedAt}\ngit_sha=${sha}\n`;
  if (outputFile) appendFileSync(outputFile, output);
  return release;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const release = prepareRelease({
    sha: process.env.RELEASE_SHA,
    outputFile: process.env.GITHUB_OUTPUT,
    metadataFile: process.env.RELEASE_METADATA_FILE,
  });
  console.log(`Prepared ${release.version} for ${release.gitSha}.`);
}
