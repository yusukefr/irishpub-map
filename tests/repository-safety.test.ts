import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findSensitiveData, stagedAddedLines } from "../scripts/check-sensitive-data.mjs";

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
    const diff = ["diff --git a/a b/a", "+++ b/a", "+https://github.com/owner/repository", `-${removedEmail}`].join("\n");

    expect(findSensitiveData(stagedAddedLines(diff))).toEqual([]);
    expect(findSensitiveData("https://example.vercel.app")).toEqual([]);
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
        encoding: "utf8"
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
          encoding: "utf8"
        });

        expect(result.status).toBe(2);
        expect(result.stderr).toContain(`Use --body-file for multi-line ${kind}.`);
      }
    }
  });

  it("requires template-based body files for pull requests", () => {
    const bodyResult = spawnSync("bash", ["scripts/create-pr.sh", "--title", "Test", "--body", "summary"], {
      cwd: process.cwd(),
      encoding: "utf8"
    });

    expect(bodyResult.status).toBe(2);
    expect(bodyResult.stderr).toContain("Use --body-file based on .github/pull_request_template.md");

    const directory = mkdtempSync(`${tmpdir()}/pull-request-body-`);
    try {
      writeFileSync(`${directory}/body.md`, "## Summary");
      const fileResult = spawnSync("bash", ["scripts/create-pr.sh", "--title", "Test", "--body-file", `${directory}/body.md`], {
        cwd: process.cwd(),
        encoding: "utf8"
      });

      expect(fileResult.status).toBe(2);
      expect(fileResult.stderr).toContain("PR body file must include the template section: ## Issue");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
