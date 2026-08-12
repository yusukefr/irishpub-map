import { execFileSync } from "node:child_process";

try {
  if (execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { encoding: "utf8" }).trim() === "true") {
    execFileSync("git", ["config", "core.hooksPath", ".githooks"]);
  }
} catch {
  // Git 管理下でない環境（パッケージ展開・CI など）ではフックの設定を省略する。
}
