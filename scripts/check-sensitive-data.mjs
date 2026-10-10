import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const PUBLIC_GITHUB_URL_PATTERNS = [
  /^https?:\/\/github\.com\/isaacs\/node-lru-cache(?:\/|$)/i,
  /^https?:\/\/github\.com\/marketplace(?:\/|$)/i,
  /^https?:\/\/github\.com\/neondatabase(?:\/|$)/i,
  /^https?:\/\/github\.com\/shuding\/better-all(?:\/|$)/i,
  /^https?:\/\/api\.github\.com\/repos\/neondatabase(?:\/|$)/i,
];

const GITHUB_ACCOUNT_URL_PATTERN =
  /https?:\/\/(?:api\.)?github\.com\/(?!(?:owner|organization|org|example|sponsors)(?:\/|$))(?:users\/|repos\/)?[A-Za-z0-9-]+(?:\/[A-Za-z0-9_.-]+)?/gi;

const DEFAULT_PATTERNS = [
  { name: "メールアドレス", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { name: "GitHub トークン", pattern: /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/i },
  { name: "API キー形式の値", pattern: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: "秘密鍵", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];
const AUTHENTICATED_URL_PATTERN = /https?:\/\/[^\s/@:]+(?::[^\s/@]*)?@[^\s/]+/i;

export function findSensitiveData(text, identifiers = [], { ignoreGithubAccountUrls = false } = {}) {
  const findings = DEFAULT_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name);
  const hasNonPublicGitHubUrl =
    !ignoreGithubAccountUrls &&
    [...text.matchAll(GITHUB_ACCOUNT_URL_PATTERN)].some(
      ([url]) => !PUBLIC_GITHUB_URL_PATTERNS.some((pattern) => pattern.test(url)),
    );
  if (hasNonPublicGitHubUrl) findings.push("GitHub アカウント URL");
  for (const identifier of identifiers) {
    if (identifier.length >= 3 && text.toLowerCase().includes(identifier.toLowerCase())) {
      findings.push("ローカル環境で指定された識別子");
    }
  }
  return [...new Set(findings)];
}

/** npm lockfileの各文字列を検査し、公開funding URLだけURL検出から除外します。
 * @param {string} content npm lockfile JSON
 * @param {string[]} identifiers ローカル環境由来の検出対象
 * @returns {string[]} 検出した機密情報の種類
 */
export function findSensitiveDataInNpmLock(content, identifiers = []) {
  let lock;
  try {
    lock = JSON.parse(content);
  } catch {
    // 壊れたJSONを検査回避に使えないよう、通常の文字列検査へフォールバックします。
    const findings = new Set(findSensitiveData(content, identifiers));
    if (AUTHENTICATED_URL_PATTERN.test(content)) findings.add("認証情報付き URL");
    return [...findings];
  }

  const findings = new Set();
  function inspect(value, field = "") {
    if (typeof value === "string") {
      for (const finding of findSensitiveData(value, identifiers)) findings.add(finding);
      if (field === "resolved" && AUTHENTICATED_URL_PATTERN.test(value)) findings.add("認証情報付き URL");
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) inspect(item, field);
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (key === "funding" && item && typeof item === "object") {
          // npmのfundingは単一オブジェクトまたは配列。各urlは公開リンクとして扱います。
          inspectFunding(item);
        } else inspect(item, key);
      }
    }
  }
  function inspectFunding(value) {
    if (Array.isArray(value)) {
      for (const item of value) inspectFunding(item);
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (key === "url" && typeof item === "string") {
          for (const finding of findSensitiveData(item, identifiers, { ignoreGithubAccountUrls: true }))
            findings.add(finding);
          if (AUTHENTICATED_URL_PATTERN.test(item)) findings.add("認証情報付き URL");
        } else inspect(item, key);
      }
    } else {
      inspect(value);
    }
  }
  inspect(lock);
  return [...findings];
}

/** staged差分の追加行をファイル単位で返します。 */
export function stagedAddedLines(diff) {
  let currentFile = "";

  return diff
    .split("\n")
    .flatMap((line) => {
      if (line.startsWith("diff --git ")) {
        currentFile = line.match(/^diff --git a\/(.+) b\/.*$/)?.[1] || "";
      }
      if (!line.startsWith("+") || line.startsWith("+++")) return [];
      return [line.slice(1)];
    })
    .join("\n");
}

function isNpmLockFile(file) {
  return file === "package-lock.json" || file.endsWith("/package-lock.json");
}

/** lockfileはindex上の完全なJSONを読み、他のファイルは追加行だけを検査します。 */
export function stagedEntries(diff, readStagedFile = (file) => runGit(["show", `:${file}`])) {
  const entries = new Map();
  let currentFile = "";
  let additions = [];
  let deleted = false;
  const save = () => {
    if (!currentFile || deleted) return;
    entries.set(currentFile, isNpmLockFile(currentFile) ? null : additions.join("\n"));
  };

  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      save();
      currentFile = line.match(/^diff --git a\/(.+) b\/.*$/)?.[1] || "";
      additions = [];
      deleted = false;
    } else if (line.startsWith("deleted file mode ")) {
      deleted = true;
    } else if (currentFile && !isNpmLockFile(currentFile) && line.startsWith("+") && !line.startsWith("+++")) {
      additions.push(line.slice(1));
    }
  }
  save();
  return [...entries].map(([file, content]) => ({ file, content: content ?? readStagedFile(file) }));
}

export function runtimeIdentifiers(environment = process.env) {
  const identifiers = (environment.SENSITIVE_IDENTIFIERS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", optional ? "ignore" : "inherit"],
    }).trim();
  } catch (error) {
    if (optional) return "";
    throw error;
  }
}

function trackedContents() {
  return runGit(["ls-files", "-z"])
    .split("\0")
    .filter(Boolean)
    .flatMap((file) => {
      if (!existsSync(file)) return [];
      const content = readFileSync(file, "utf8");
      return content.includes("\0") ? [] : [{ file, content }];
    });
}

function checkEntries(entries) {
  const identifiers = runtimeIdentifiers();
  const failures = entries.flatMap(({ file, content }) =>
    (isNpmLockFile(file)
      ? findSensitiveDataInNpmLock(content, identifiers)
      : findSensitiveData(content, identifiers)
    ).map((finding) => `${file}: ${finding}`),
  );
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
    checkEntries(stagedEntries(diff));
  }
}
