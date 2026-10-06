import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyGitChange,
  classifyPaths,
  classifyReleaseChanges,
  shouldRunE2e,
  shouldRunFullCi,
} from "../scripts/classify-ci-changes.mjs";

function git(cwd: string, ...args: string[]) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

describe("CI change classification", () => {
  it("runs only the sensitive check for documentation paths", () => {
    expect(classifyPaths(["README.md", "docs/runbooks/release-operations.md", ".agents/skills/example.md"])).toEqual({
      codeChanged: false,
      openapiChanged: false,
      workflowChanged: false,
      releaseRelevant: false,
      e2eRelevant: false,
    });
  });

  it("runs OpenAPI lint without app builds", () => {
    expect(classifyPaths(["docs/specs/openapi/openapi.yaml", "docs/specs/api.md"])).toEqual({
      codeChanged: false,
      openapiChanged: true,
      workflowChanged: false,
      releaseRelevant: false,
      e2eRelevant: false,
    });
  });

  it("runs full CI for code and markdown inside the app", () => {
    expect(classifyPaths(["apps/web/app/page.tsx", "apps/web/content/help.md"])).toEqual({
      codeChanged: true,
      openapiChanged: false,
      workflowChanged: false,
      releaseRelevant: true,
      e2eRelevant: true,
    });
  });

  it("lints workflow changes", () => {
    expect(classifyPaths([".github/workflows/ci.yml"])).toEqual({
      codeChanged: true,
      openapiChanged: false,
      workflowChanged: true,
      releaseRelevant: false,
      e2eRelevant: false,
    });
  });

  it("treats a rename from code into docs as a code change when both paths are provided", () => {
    expect(classifyPaths(["apps/web/content/guide.md", "docs/guide.md"]).codeChanged).toBe(true);
    expect(classifyPaths(["apps/web/content/guide.md", "docs/guide.md"]).releaseRelevant).toBe(true);
  });

  it("runs E2E for UI, Storybook, and browser test changes", () => {
    for (const path of [
      "apps/web/app/(map)/page.tsx",
      "apps/web/app/components/pub-map.tsx",
      "apps/web/app/globals.css",
      "apps/web/app/lib/pub-search.ts",
      "apps/web/app/lib/media/use-media-library.ts",
      "apps/web/content/future-page.md",
      "apps/web/public/icon.svg",
      "apps/web/stories/public-ui.stories.tsx",
      "apps/web/tailwind.config.ts",
      ".storybook/main.ts",
      "e2e/support/page-helpers.ts",
      "tests/e2e/future.spec.ts",
      "playwright.config.ts",
      "playwright.storybook.config.ts",
      "packages/shared/src/tag.ts",
      "packages/shared/src/locale.ts",
      "packages/shared/src/prefecture.ts",
      "packages/shared/src/pub.ts",
      "packages/shared/package.json",
    ]) {
      expect(classifyPaths([path]).e2eRelevant, path).toBe(true);
    }
  });

  it("skips E2E for backend, unit test, and documentation-only changes", () => {
    for (const path of [
      "apps/web/app/api/pubs/route.ts",
      "apps/web/app/lib/pub-repository.ts",
      "apps/web/app/lib/admin-pub-service.ts",
      "tests/pub-repository.test.ts",
      "docs/runbooks/release-operations.md",
      "apps/web/AGENTS.md",
      "apps/web/CLAUDE.md",
    ]) {
      expect(classifyPaths([path]).e2eRelevant, path).toBe(false);
    }
  });

  it("runs E2E for UI PRs, main pushes, and explicit manual requests", () => {
    const ui = classifyPaths(["apps/web/app/components/pub-map.tsx"]);
    const shared = classifyPaths(["packages/shared/src/tag.ts"]);
    const backend = classifyPaths(["apps/web/app/api/pubs/route.ts"]);
    expect(shouldRunE2e(ui, { eventName: "pull_request", ref: "refs/pull/553/merge" })).toBe(true);
    expect(shouldRunE2e(shared, { eventName: "pull_request", ref: "refs/pull/553/merge" })).toBe(true);
    expect(shouldRunE2e(backend, { eventName: "pull_request", ref: "refs/pull/553/merge" })).toBe(false);
    expect(shouldRunE2e(classifyPaths(["README.md"]), { eventName: "pull_request" })).toBe(false);
    expect(shouldRunE2e(backend, { eventName: "push", ref: "refs/heads/main" })).toBe(true);
    expect(shouldRunE2e(backend, { eventName: "push", ref: "refs/heads/feature" })).toBe(false);
    expect(shouldRunE2e(ui, { eventName: "workflow_dispatch", ref: "refs/heads/main" })).toBe(false);
    expect(shouldRunE2e(backend, { eventName: "workflow_dispatch", runE2eInput: "true" })).toBe(true);
  });

  it("releases production inputs but skips CI, test, and documentation-only changes", () => {
    expect(classifyPaths(["package.json", "vercel.json", "scripts/validate-production-env.mjs"]).releaseRelevant).toBe(
      true,
    );
    expect(classifyPaths(["packages/shared/src/pub.ts", "e2e/mobile-map.spec.ts"]).releaseRelevant).toBe(true);
    expect(
      classifyPaths([".github/workflows/release.yml", "tests/prepare-release.test.ts", "e2e/mobile-map.spec.ts"])
        .releaseRelevant,
    ).toBe(false);
    expect(classifyPaths(["apps/web/AGENTS.md", "docs/specs/openapi/openapi.yaml"]).releaseRelevant).toBe(false);
  });

  it("runs full main CI for unreleased app changes carried by a docs-only push", () => {
    const pendingRelease = { codeChanged: false, releaseRelevant: true };
    expect(shouldRunFullCi(pendingRelease, "push")).toBe(true);
    expect(shouldRunFullCi(pendingRelease, "pull_request")).toBe(false);
    expect(shouldRunFullCi({ codeChanged: false, releaseRelevant: false }, "push")).toBe(false);
    expect(shouldRunFullCi({ codeChanged: true, releaseRelevant: false }, "pull_request")).toBe(true);
  });

  it("runs full checks when a diff cannot be trusted", () => {
    expect(classifyPaths([])).toEqual({
      codeChanged: true,
      openapiChanged: true,
      workflowChanged: true,
      releaseRelevant: false,
      e2eRelevant: true,
    });
    expect(classifyGitChange({ eventName: "pull_request", baseSha: "0".repeat(40), headSha: "a".repeat(40) })).toEqual(
      classifyPaths([]),
    );
    expect(classifyGitChange({ eventName: "workflow_dispatch", baseSha: "", headSha: "" })).toEqual(classifyPaths([]));
  });

  it("keeps unreleased app changes relevant across a later docs-only push", () => {
    const cwd = mkdtempSync(join(tmpdir(), "irishpub-release-classification-"));
    try {
      git(cwd, "init", "--initial-branch=main");
      git(cwd, "config", "user.name", "Release Test");
      git(cwd, "config", "user.email", "release-test@localhost");
      writeFileSync(join(cwd, "README.md"), "baseline\n");
      git(cwd, "add", ".");
      git(cwd, "commit", "-m", "baseline");
      const baseline = git(cwd, "rev-parse", "HEAD");
      git(cwd, "tag", "-a", "v0.1.64", "-m", "Release v0.1.64");

      mkdirSync(join(cwd, "apps", "web"), { recursive: true });
      writeFileSync(join(cwd, "apps", "web", "page.tsx"), "export default function Page() { return null; }\n");
      git(cwd, "add", ".");
      git(cwd, "commit", "-m", "app change");
      const appCommit = git(cwd, "rev-parse", "HEAD");

      mkdirSync(join(cwd, "docs"));
      writeFileSync(join(cwd, "docs", "guide.md"), "Documentation only\n");
      git(cwd, "add", ".");
      git(cwd, "commit", "-m", "docs change");
      const docsCommit = git(cwd, "rev-parse", "HEAD");

      expect(classifyGitChange({ eventName: "push", baseSha: baseline, headSha: appCommit, cwd }).releaseRelevant).toBe(
        true,
      );
      expect(classifyGitChange({ eventName: "push", baseSha: appCommit, headSha: docsCommit, cwd })).toEqual({
        codeChanged: false,
        openapiChanged: false,
        workflowChanged: false,
        releaseRelevant: true,
        e2eRelevant: false,
      });
      expect(
        classifyGitChange({ eventName: "push", baseSha: "0".repeat(40), headSha: docsCommit, cwd }).releaseRelevant,
      ).toBe(true);

      git(cwd, "tag", "-a", "v0.1.65", appCommit, "-m", "Release v0.1.65");
      expect(classifyReleaseChanges({ cwd, headSha: appCommit })).toBe(false);
      expect(classifyReleaseChanges({ cwd, headSha: docsCommit })).toBe(false);
      expect(
        classifyGitChange({ eventName: "push", baseSha: appCommit, headSha: docsCommit, cwd }).releaseRelevant,
      ).toBe(false);
      expect(classifyReleaseChanges({ cwd, headSha: baseline })).toBe(false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
