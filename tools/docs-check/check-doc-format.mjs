import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** PrettierにMarkdownを渡し、独立したMermaid図はMermaid検査へ委ねます。
 * @param {string[]} files tracked file paths
 * @returns {string[]} Markdown file paths
 */
export function markdownFormatFiles(files) {
  return files.filter((file) => /\.md$/i.test(file));
}

if (process.argv[1]?.endsWith("check-doc-format.mjs")) {
  const files = markdownFormatFiles(execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0"));

  if (files.length === 0) {
    process.stdout.write("No tracked Markdown files to format-check.\n");
    process.exit(0);
  }

  const prettier = fileURLToPath(new URL("./node_modules/.bin/prettier", import.meta.url));
  execFileSync(prettier, ["--check", ...files], { stdio: "inherit" });
}
