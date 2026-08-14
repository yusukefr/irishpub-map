import { randomBytes } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const DEFAULT_API_KEY_COUNT = 5;
export const MAX_API_KEY_COUNT = 100;
export const DEFAULT_OUTPUT_PATH = "api-keys.txt";
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

/** コマンドライン引数から生成数と出力先を取得します。 */
export function parseArguments(args) {
  if (args.length > 2) throw new Error(`Usage: node scripts/generate-api-keys.mjs [count] [output-file] (1-${MAX_API_KEY_COUNT})`);

  return {
    count: parseCount(args.slice(0, 1)),
    outputPath: args[1] || DEFAULT_OUTPUT_PATH
  };
}

/** 暗号学的に安全な乱数から API キーを1つ生成します。 */
export function generateApiKey() {
  return `ipm_${randomBytes(API_KEY_BYTES).toString("base64url")}`;
}

/** 指定数の API キーを生成します。 */
export function generateApiKeys(count) {
  return Array.from({ length: count }, generateApiKey);
}

/** API キーを指定ファイルへ保存し、所有者だけが読める権限に設定します。 */
export async function writeApiKeys(outputPath, apiKeys) {
  await writeFile(outputPath, `${apiKeys.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(outputPath, 0o600);
}

async function main() {
  const { count, outputPath } = parseArguments(process.argv.slice(2));
  await writeApiKeys(outputPath, generateApiKeys(count));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Failed to generate API keys.");
    process.exitCode = 1;
  }
}
