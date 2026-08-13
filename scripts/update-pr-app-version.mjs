import { readFile } from "node:fs/promises";

const SECTION_START = "<!-- app-version:start -->";
const SECTION_END = "<!-- app-version:end -->";

/** PR本文へ挿入するデプロイバージョン欄を生成します。 */
export function createAppVersionSection({ version, releaseDate }) {
  return `${SECTION_START}\n## App Version\n\n- Deployed version: \`v${version}\`\n- Release date: \`${releaseDate} JST\`\n${SECTION_END}`;
}

/** PR本文の既存バージョン欄を更新し、なければ末尾へ追加します。 */
export function upsertAppVersionSection(body, versionInfo) {
  const section = createAppVersionSection(versionInfo);
  const sectionPattern = new RegExp(`${escapeRegExp(SECTION_START)}[\\s\\S]*?${escapeRegExp(SECTION_END)}`);
  return sectionPattern.test(body) ? body.replace(sectionPattern, section) : `${body.trimEnd()}\n\n${section}\n`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** ワークフローから渡されたPR本文を標準入力ストリームから読み取ります。 */
export async function readStdin(stream = process.stdin) {
  let body = "";
  for await (const chunk of stream) body += chunk;
  return body;
}

async function main() {
  const body = await readStdin();
  const versionInfo = JSON.parse(await readFile("app-version.json", "utf8"));
  process.stdout.write(upsertAppVersionSection(body, versionInfo));
}

if (process.argv[1]?.endsWith("update-pr-app-version.mjs")) await main();
