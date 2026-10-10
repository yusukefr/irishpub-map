// 機密情報検出とGitHub操作スクリプトの安全条件を保証するテストです。
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findSensitiveData,
  findSensitiveDataInNpmLock,
  stagedAddedLines,
  stagedEntries,
} from "../scripts/check-sensitive-data.mjs";

describe("repository safety check", () => {
  it("detects external account information and secret-shaped values", () => {
    const githubProfile = ["https://github", ".com/", "private-account"].join("");
    const token = ["gh", "p_", "abcdefghijklmnopqrstuvwxyz123456"].join("");
    const email = ["contact", "@", "example.test"].join("");
    const findings = findSensitiveData(`${githubProfile}\n${email}\n${token}`);

    expect(findings).toContain("GitHub アカウント URL");
    expect(findings).toContain("メールアドレス");
    expect(findings).toContain("GitHub トークン");
  });

  it("allows generic repository examples and only checks added lines", () => {
    const removedEmail = ["contact", "@", "example.test"].join("");
    const diff = ["diff --git a/a b/a", "+++ b/a", "+https://github.com/owner/repository", `-${removedEmail}`].join(
      "\n",
    );

    expect(findSensitiveData(stagedAddedLines(diff))).toEqual([]);
    expect(findSensitiveData("https://example.vercel.app")).toEqual([]);
    expect(findSensitiveData("https://github.com/neondatabase/agent-skills")).toEqual([]);
    expect(findSensitiveData("https://api.github.com/repos/neondatabase/agent-skills")).toEqual([]);
    expect(findSensitiveData("https://github.com/marketplace/actions/neon-schema-diff-github-action")).toEqual([]);
    expect(findSensitiveData("https://github.com/isaacs/node-lru-cache")).toEqual([]);
    expect(findSensitiveData("https://github.com/shuding/better-all")).toEqual([]);
  });

  it("checks funding metadata in a root lockfile without flagging public GitHub URLs", () => {
    const fundingUrl = ["https://github", ".com/", "prettier/prettier"].join("");
    const lock = JSON.stringify({ packages: { "": { funding: { type: "individual", url: fundingUrl } } } });

    expect(findSensitiveDataInNpmLock(lock)).toEqual([]);
  });

  it("detects credentials and tokens in nested npm lockfile metadata", () => {
    const fundingUrl = ["https://github", ".com/", "prettier/prettier"].join("");
    const token = ["github_pat_", "abcdefghijklmnopqrstuvwxyz123456"].join("");
    const authenticatedUrl = [
      "https://username:",
      "placeholder-password",
      "@registry.npmjs.org/private-package.tgz",
    ].join("");
    const lock = JSON.stringify({
      packages: {
        "node_modules/public-package": { funding: { type: "individual", url: fundingUrl } },
        "node_modules/private-package": {
          resolved: authenticatedUrl,
          integrity: `sha512-${token}`,
        },
      },
    });

    expect(findSensitiveDataInNpmLock(lock)).toContain("認証情報付き URL");
    expect(findSensitiveDataInNpmLock(lock)).toContain("GitHub トークン");
  });

  it("reads the complete staged lockfile so funding metadata does not hide other sensitive values", () => {
    const fundingUrl = ["https://github", ".com/", "prettier/prettier"].join("");
    const token = ["github_pat_", "abcdefghijklmnopqrstuvwxyz123456"].join("");
    const stagedLock = JSON.stringify({
      packages: {
        "": { funding: { url: fundingUrl } },
        secret: { resolved: token },
      },
    });
    const nameStatus = "M\0tools/docs-check/package-lock.json\0";

    const entries = stagedEntries(nameStatus, () => stagedLock);
    expect(entries).toHaveLength(1);
    expect(findSensitiveDataInNpmLock(entries[0].content)).toContain("GitHub トークン");
    expect(findSensitiveData(stagedAddedLines("diff --git a/a b/a\n+++ b/a\n+safe"))).toEqual([]);
  });

  it("checks a lockfile renamed from the repository root into a nested path", () => {
    const directory = mkdtempSync(`${tmpdir()}/repository-safety-lock-rename-`);
    const script = resolve("scripts/check-sensitive-data.mjs");
    try {
      initializeGitRepository(directory);
      const fundingUrl = ["https://github", ".com/", "prettier/prettier"].join("");
      writeFileSync(
        `${directory}/package-lock.json`,
        JSON.stringify({ packages: { "": { funding: { type: "individual", url: fundingUrl } } } }),
      );
      spawnSync("git", ["add", "package-lock.json"], { cwd: directory });
      spawnSync("git", ["commit", "-m", "Add lockfile"], { cwd: directory });
      mkdirSync(`${directory}/tools/docs-check`, { recursive: true });
      const rename = spawnSync("git", ["mv", "package-lock.json", "tools/docs-check/package-lock.json"], {
        cwd: directory,
        encoding: "utf8",
      });
      expect(rename.status).toBe(0);

      const result = spawnSync(process.execPath, [script, "--staged"], {
        cwd: directory,
        encoding: "utf8",
      });

      expect(result.status).toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("detects sensitive values when a regular JSON file is renamed to a nested lockfile", () => {
    const directory = mkdtempSync(`${tmpdir()}/repository-safety-lock-rename-`);
    const script = resolve("scripts/check-sensitive-data.mjs");
    try {
      initializeGitRepository(directory);
      const token = ["github_pat_", "abcdefghijklmnopqrstuvwxyz123456"].join("");
      writeFileSync(`${directory}/ordinary.json`, JSON.stringify({ packages: { package: { resolved: token } } }));
      spawnSync("git", ["add", "ordinary.json"], { cwd: directory });
      spawnSync("git", ["commit", "-m", "Add JSON file"], { cwd: directory });
      mkdirSync(`${directory}/packages/demo`, { recursive: true });
      const rename = spawnSync("git", ["mv", "ordinary.json", "packages/demo/package-lock.json"], {
        cwd: directory,
        encoding: "utf8",
      });
      expect(rename.status).toBe(0);

      const result = spawnSync(process.execPath, [script, "--staged"], {
        cwd: directory,
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("GitHub トークン");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("detects configured account identifiers without storing them in the repository", () => {
    expect(findSensitiveData("managed identifier", ["managed identifier"])).toContain("ローカル環境で指定された識別子");
  });
  it("rejects a staged account URL through the pre-commit command", () => {
    const directory = mkdtempSync(`${tmpdir()}/repository-safety-`);
    const script = resolve("scripts/check-sensitive-data.mjs");
    try {
      spawnSync("git", ["init"], { cwd: directory });
      const email = ["test", "@", "example.test"].join("");
      spawnSync("git", ["config", "user.email", email], { cwd: directory });
      spawnSync("git", ["config", "user.name", "Test User"], { cwd: directory });
      writeFileSync(`${directory}/account.txt`, ["https://github", ".com/", "private-account"].join(""));
      spawnSync("git", ["add", "account.txt"], { cwd: directory });

      const result = spawnSync(process.execPath, [script, "--staged"], {
        cwd: directory,
        encoding: "utf8",
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("GitHub アカウント URL");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("requires body files for multi-line issue comments", () => {
    const cases = [["scripts/comment-issue-design.sh", ["--issue", "1", "--body"], "issue comments"]] as const;

    for (const [script, argumentsBeforeBody, kind] of cases) {
      for (const body of ["first\\nsecond", "first\nsecond"]) {
        const result = spawnSync("bash", [script, ...argumentsBeforeBody, body], {
          cwd: process.cwd(),
          encoding: "utf8",
        });

        expect(result.status).toBe(2);
        expect(result.stderr).toContain(`Use --body-file for multi-line ${kind}.`);
      }
    }
  });

  it("requires template-based body files for pull requests", () => {
    const bodyResult = spawnSync("bash", ["scripts/create-pr.sh", "--title", "Test", "--body", "summary"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(bodyResult.status).toBe(2);
    expect(bodyResult.stderr).toContain("Use --body-file based on .github/pull_request_template.md");

    const directory = mkdtempSync(`${tmpdir()}/pull-request-body-`);
    try {
      writeFileSync(`${directory}/body.md`, "## Summary");
      const fileResult = spawnSync(
        "bash",
        ["scripts/create-pr.sh", "--title", "Test", "--body-file", `${directory}/body.md`],
        {
          cwd: process.cwd(),
          encoding: "utf8",
        },
      );

      expect(fileResult.status).toBe(2);
      expect(fileResult.stderr).toContain("PR body file must include the template section: ## Issue");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

function initializeGitRepository(directory: string) {
  spawnSync("git", ["init"], { cwd: directory });
  const email = ["test", "@", "example.test"].join("");
  spawnSync("git", ["config", "user.email", email], { cwd: directory });
  spawnSync("git", ["config", "user.name", "Test User"], { cwd: directory });
}
