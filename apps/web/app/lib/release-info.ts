/** Production成果物と同じmetadataからPublic/Admin表示を組み立てます。 */
export type ReleaseInfo = {
  version: string;
  releasedAt: string | null;
  gitSha: string | null;
};

const VERSION = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const RELEASE_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$/;
const GIT_SHA = /^[0-9a-f]{40}$/i;

function formatJstDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute} JST`;
}

/**
 * 3値が揃い、JST日時とSHAが有効な場合だけRelease情報として採用します。
 * @param {NodeJS.ProcessEnv} environment - 検証対象の環境変数。
 * @returns {ReleaseInfo | null} 有効なRelease情報、またはnull。
 */
export function parseReleaseInfo(environment: NodeJS.ProcessEnv): ReleaseInfo | null {
  const version = environment.APP_RELEASE_VERSION;
  const releasedAt = environment.APP_RELEASE_DATE;
  const gitSha = environment.APP_RELEASE_GIT_SHA;
  if (
    !version ||
    !VERSION.test(version) ||
    !releasedAt ||
    !RELEASE_DATE.test(releasedAt) ||
    !gitSha ||
    !GIT_SHA.test(gitSha)
  ) {
    return null;
  }
  const date = new Date(releasedAt);
  if (
    Number.isNaN(date.getTime()) ||
    formatJstDate(date) !== `${releasedAt.slice(0, 10)} ${releasedAt.slice(11, 16)} JST`
  ) {
    return null;
  }
  return { version, releasedAt: formatJstDate(date), gitSha };
}

/**
 * Local/Previewはfallbackを返し、Productionのmetadata欠落は誤表示せず停止します。
 * @param {NodeJS.ProcessEnv} environment - Release metadataを含む環境変数。
 * @returns {ReleaseInfo} Release情報またはLocal/Previewのfallback。
 */
export function getReleaseInfo(environment: NodeJS.ProcessEnv = process.env): ReleaseInfo {
  if (environment.VERCEL_ENV === "preview") return { version: "preview", releasedAt: null, gitSha: null };
  const release = parseReleaseInfo(environment);
  if (release) return release;
  if (environment.VERCEL_ENV === "production") throw new Error("Production release metadata is missing or invalid.");
  return {
    version: "dev",
    releasedAt: null,
    gitSha: null,
  };
}
