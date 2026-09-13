import { chmod, open } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
import process from "node:process";

/**
 * TTYからpasswordを非表示で読み取ります。
 * @param {string} prompt - 入力前に表示する説明。
 * @returns {Promise<string>} 入力されたpassword。
 */
function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      reject(new Error("An interactive TTY is required."));
      return;
    }

    let value = "";
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Input cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          cleanup();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (character === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    };
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };

    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

/**
 * Admin認証用の環境変数ファイルを新規作成します。
 * passwordや生成値を標準出力へ表示せず、既存ファイルを上書きしません。
 */
async function main() {
  const outputPath = process.argv[2];
  if (!outputPath || process.argv.length !== 3) {
    throw new Error("Usage: node scripts/generate-admin-secrets.mjs <output-file>");
  }

  const password = await readHidden("Admin password: ");
  const confirmation = await readHidden("Confirm password: ");
  if (!password || password !== confirmation) throw new Error("Passwords do not match or are empty.");

  const salt = randomBytes(16).toString("base64");
  const passwordHash = scryptSync(password, salt, 64).toString("base64");
  const sessionSecret = randomBytes(48).toString("base64url");
  const contents = `ADMIN_PASSWORD_HASH=${salt}:${passwordHash}\nADMIN_SESSION_SECRET=${sessionSecret}\n`;

  const handle = await open(outputPath, "wx", 0o600);
  try {
    await handle.writeFile(contents, "utf8");
  } finally {
    await handle.close();
  }
  await chmod(outputPath, 0o600);
  console.log(`Created ${outputPath} with mode 0600.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
