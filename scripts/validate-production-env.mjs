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
  return !isProductionEnvironment(environment) || isProductionApiKeyConfigured(environment);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href && !validateProductionEnvironment()) {
  console.error("Production の必須環境変数が設定されていません。IRISHPUB_MAP_API_KEY を Vercel の Production 環境に設定してください。");
  process.exitCode = 1;
}
