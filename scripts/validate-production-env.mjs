/** Vercel Production に必要な環境変数が設定されているかを検証します。 */
export function isProductionEnvironment(environment = process.env) {
  return environment.VERCEL_ENV === "production";
}

/** Production 用 API キーが空でないかを検証します。 */
export function isProductionApiKeyConfigured(environment = process.env) {
  return typeof environment.IRISHPUB_MAP_API_KEY === "string" && environment.IRISHPUB_MAP_API_KEY.trim().length > 0;
}

/** Production の環境変数が有効なら true を返します。 */
export function validateProductionEnvironment(environment = process.env) {
  return (
    !isProductionEnvironment(environment) ||
    (isProductionApiKeyConfigured(environment) && isProductionReleaseConfigured(environment))
  );
}

/** Production成果物に固定するRelease metadataが揃っているかを確認します。 */
export function isProductionReleaseConfigured(environment = process.env) {
  const version = environment.APP_RELEASE_VERSION;
  const releasedAt = environment.APP_RELEASE_DATE;
  const gitSha = environment.APP_RELEASE_GIT_SHA;
  if (
    !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? "") ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+09:00$/.test(releasedAt ?? "") ||
    !/^[0-9a-f]{40}$/i.test(gitSha ?? "")
  ) {
    return false;
  }
  const date = new Date(releasedAt);
  if (Number.isNaN(date.getTime())) return false;
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
  return releasedAt === `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:00+09:00`;
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href && !validateProductionEnvironment()) {
  console.error("Production の必須環境変数が不足、または無効です。API keyとRelease metadataの設定を確認してください。");
  process.exitCode = 1;
}
