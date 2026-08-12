import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const DEFAULT_PATTERNS = [
  { name: "メールアドレス", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { name: "GitHub アカウント URL", pattern: /https?:\/\/(?:api\.)?github\.com\/(?!(?:owner|organization|org|example|sponsors)(?:\/|$))(?:users\/|repos\/)?[A-Za-z0-9-]+(?:\/[A-Za-z0-9_.-]+)?/i },
  { name: "GitHub トークン", pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/i },
  { name: "API キー形式の値", pattern: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "秘密鍵", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ }
];

export function findSensitiveData(text, identifiers = []) {
  const findings = DEFAULT_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
  for (const identifier of identifiers) {
    if (identifier.length >= 3 && text.toLowerCase().includes(identifier.toLowerCase())) {
      findings.push("ローカル環境で指定された識別子");
    }
  }
  return [...new Set(findings)];
}

export function stagedAddedLines(diff) {
  return diff.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).map((line) => line.slice(1)).join("\n");
}

export function runtimeIdentifiers(environment = process.env) {
  const identifiers = (environment.SENSITIVE_IDENTIFIERS || "").split(",").map((item) => item.trim()).filter(Boolean);
  for (const key of ["user.name", "user.email"]) {
    const value = runGit(["config", "--get", key], true);
    if (value) identifiers.push(value);
  }
  const remote = runGit(["remote", "get-url", "origin"], true);
  const owner = remote?.match(/(?:github\.com[/:]|github\.com-[^:]+:)([^/]+)\//)?.[1];
  if (owner) identifiers.push(owner);
  const configuredOwner = environment.GH_REPO?.split("/")[0];
  if (configuredOwner) identifiers.push(configuredOwner);
  return [...new Set(identifiers)];
}

function runGit(args, optional = false) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", optional ? "ignore" : "inherit"] }).trim();
  } catch (error) {
    if (optional) return "";
    throw error;
  }
}

function trackedContents() {
  return runGit(["ls-files", "-z"]).split("\0").filter(Boolean).filter((file) => file !== "package-lock.json").flatMap((file) => {
    if (!existsSync(file)) return [];
    const content = readFileSync(file, "utf8");
    return content.includes("\0") ? [] : [{ file, content }];
  });
}

function checkEntries(entries) {
  const identifiers = runtimeIdentifiers();
  const failures = entries.flatMap(({ file, content }) => findSensitiveData(content, identifiers).map((finding) => `${file}: ${finding}`));
  if (failures.length === 0) return;

  console.error("リポジトリへの追加を中止しました。公開不要な情報を環境変数またはローカル設定へ移してください。");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  if (process.argv[2] === "--tracked") {
    checkEntries(trackedContents());
  } else {
    const diff = runGit(["diff", "--cached", "--unified=0", "--no-ext-diff"]);
    checkEntries([{ file: "ステージ済み差分", content: stagedAddedLines(diff) }]);
  }
}
