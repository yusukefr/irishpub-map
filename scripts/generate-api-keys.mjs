import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

export const DEFAULT_API_KEY_COUNT = 5;
export const MAX_API_KEY_COUNT = 100;
const API_KEY_BYTES = 32;

/** コマンドライン引数から生成する API キー数を取得します。 */
export function parseCount(args) {
  if (args.length > 1) throw new Error(`Usage: node scripts/generate-api-keys.mjs [count] (1-${MAX_API_KEY_COUNT})`);
  if (!args[0]) return DEFAULT_API_KEY_COUNT;

  const count = Number(args[0]);
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_API_KEY_COUNT) {
    throw new Error(`Count must be an integer between 1 and ${MAX_API_KEY_COUNT}.`);
  }

  return count;
}

/** 暗号学的に安全な乱数から API キーを1つ生成します。 */
export function generateApiKey() {
  return `ipm_${randomBytes(API_KEY_BYTES).toString("base64url")}`;
}

/** 指定数の API キーを生成します。 */
export function generateApiKeys(count) {
  return Array.from({ length: count }, generateApiKey);
}

function main() {
  for (const apiKey of generateApiKeys(parseCount(process.argv.slice(2)))) {
    console.log(apiKey);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Failed to generate API keys.");
    process.exitCode = 1;
  }
}
