import { describe, expect, it } from "vitest";
import { classifyGitChange, classifyPaths } from "../scripts/classify-ci-changes.mjs";

describe("CI change classification", () => {
  it("runs only the sensitive check for documentation paths", () => {
    expect(classifyPaths(["README.md", "docs/runbooks/release-operations.md", ".agents/skills/example.md"])).toEqual({
      codeChanged: false,
      openapiChanged: false,
      workflowChanged: false,
      versionRelevant: false,
    });
  });

  it("runs OpenAPI lint without app builds or a version bump", () => {
    expect(classifyPaths(["docs/specs/openapi/openapi.yaml", "docs/specs/api.md"])).toEqual({
      codeChanged: false,
      openapiChanged: true,
      workflowChanged: false,
      versionRelevant: false,
    });
  });

  it("runs full CI for code and markdown inside the app", () => {
    expect(classifyPaths(["apps/web/app/page.tsx", "apps/web/content/help.md"])).toEqual({
      codeChanged: true,
      openapiChanged: false,
      workflowChanged: false,
      versionRelevant: true,
    });
  });

  it("lints workflow changes without bumping the app version", () => {
    expect(classifyPaths([".github/workflows/ci.yml"])).toEqual({
      codeChanged: true,
      openapiChanged: false,
      workflowChanged: true,
      versionRelevant: false,
    });
  });

  it("treats a rename from code into docs as a code change when both paths are provided", () => {
    expect(classifyPaths(["apps/web/content/guide.md", "docs/guide.md"]).codeChanged).toBe(true);
  });

  it("runs full checks when a diff cannot be trusted", () => {
    expect(classifyPaths([])).toEqual({
      codeChanged: true,
      openapiChanged: true,
      workflowChanged: true,
      versionRelevant: true,
    });
    expect(classifyGitChange({ eventName: "push", baseSha: "0".repeat(40), headSha: "a".repeat(40) })).toEqual(
      classifyPaths([]),
    );
    expect(classifyGitChange({ eventName: "workflow_dispatch", baseSha: "", headSha: "" })).toEqual(classifyPaths([]));
  });
});
