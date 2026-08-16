import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_VERSION_FILE = new URL("../app-version.json", import.meta.url);
const DEFAULT_PACKAGE_FILE = new URL("../package.json", import.meta.url);
const DEFAULT_LOCK_FILE = new URL("../package-lock.json", import.meta.url);
const JST_TIME_ZONE = "Asia/Tokyo";

/** セマンティックバージョンの更新種別です。 */
export const VERSION_BUMP_TYPES = ["patch", "minor"];

/** バージョン文字列の末尾またはマイナー番号を更新します。 */
export function bumpVersion(version, bumpType = "patch") {
  if (!VERSION_BUMP_TYPES.includes(bumpType)) throw new Error(`Unsupported version bump type: ${bumpType}`);
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Invalid semantic version: ${version}`);

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  return bumpType === "minor" ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
}

/** 指定時刻を日本時間のYYYY-MM-DD形式へ変換します。 */
export function formatJstDate(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** バージョンファイルとルートnpmメタデータを更新します。 */
export async function updateAppVersion(
  versionFile = DEFAULT_VERSION_FILE,
  bumpType = process.env.APP_VERSION_BUMP ?? "patch",
  now = new Date(),
  packageFile = DEFAULT_PACKAGE_FILE,
  lockFile = DEFAULT_LOCK_FILE,
) {
  const current = JSON.parse(await readFile(versionFile, "utf8"));
  if (typeof current.version !== "string") throw new Error("app-version.json must contain a version string.");

  const next = { version: bumpVersion(current.version, bumpType), releaseDate: formatJstDate(now) };
  const packageJson = JSON.parse(await readFile(packageFile, "utf8"));
  if (typeof packageJson.version !== "string") throw new Error("package.json must contain a version string.");

  const packageLock = JSON.parse(await readFile(lockFile, "utf8"));
  if (typeof packageLock.version !== "string" || typeof packageLock.packages?.[""]?.version !== "string") {
    throw new Error("package-lock.json must contain root package version metadata.");
  }

  packageJson.version = next.version;
  packageLock.version = next.version;
  packageLock.packages[""].version = next.version;
  await writeFile(versionFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  await writeFile(lockFile, `${JSON.stringify(packageLock, null, 2)}\n`, "utf8");
  return next;
}

/** デプロイ成果物へ反映するリリース日だけを日本時間で更新します。 */
export async function updateReleaseDate(versionFile = DEFAULT_VERSION_FILE, now = new Date()) {
  const current = JSON.parse(await readFile(versionFile, "utf8"));
  if (typeof current.version !== "string") throw new Error("app-version.json must contain a version string.");

  const next = { version: current.version, releaseDate: formatJstDate(now) };
  await writeFile(versionFile, JSON.stringify(next, null, 2) + String.fromCharCode(10), "utf8");
  return next;
}

/** Vercelのビルド前にアプリの表示バージョンまたはリリース日を更新します。 */
async function main() {
  const next = process.argv.includes("--date-only") ? await updateReleaseDate() : await updateAppVersion();
  console.log(`Updated app version to v${next.version} (${next.releaseDate} JST).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
