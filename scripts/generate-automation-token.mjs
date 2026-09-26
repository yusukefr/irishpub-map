import { createHash, randomBytes } from "node:crypto";
import process from "node:process";

/**
 * 32 byteの乱数からAutomation TokenとServer設定用SHA-256を生成します。
 * Secretをリポジトリ管理ファイルへ保存せず、対話端末に一度だけ表示します。
 */
function main() {
  if (process.argv.length !== 2 || !process.stdout.isTTY) {
    throw new Error("Run node scripts/generate-automation-token.mjs in an interactive terminal.");
  }

  const token = `ipm_automation_v1_${randomBytes(32).toString("base64url")}`;
  const hash = createHash("sha256").update(token).digest("hex");
  process.stdout.write(`Automation Token (shown once):\n${token}\n\nSHA-256 (server setting):\n${hash}\n`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "Token generation failed.");
  process.exitCode = 1;
}
