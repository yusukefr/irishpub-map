import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((file) => /\.(?:md|mmd)$/i.test(file));

if (files.length === 0) {
  process.stdout.write("No tracked Markdown or Mermaid files to format-check.\n");
  process.exit(0);
}

const prettier = fileURLToPath(new URL("./node_modules/.bin/prettier", import.meta.url));
execFileSync(prettier, ["--check", ...files], { stdio: "inherit" });
