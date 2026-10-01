import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findConfusableWarnings,
  findUnicodeIssues,
  instructionPathIssue,
  isSecurityTarget,
} from "../scripts/check-llm-security.mjs";

const script = resolve("scripts/check-llm-security.mjs");

describe("LLM security content check", () => {
  it.each([
    "通常の日本語と英語 English",
    "# Markdown\n\n[link](https://example.test/path)",
    "絵文字 🌍 🗺",
    "\tTabbed\nLine\r\nNext line",
    "Café は NFC",
  ])("allows normal text: %s", (content) => {
    expect(findUnicodeIssues(content)).toEqual([]);
  });

  it.each([
    [0x200b, "ZERO WIDTH SPACE"],
    [0x200c, "ZERO WIDTH NON-JOINER"],
    [0x200d, "ZERO WIDTH JOINER"],
    [0x202e, "RIGHT-TO-LEFT OVERRIDE"],
    [0x2066, "LEFT-TO-RIGHT ISOLATE"],
    [0x2067, "RIGHT-TO-LEFT ISOLATE"],
    [0x2068, "FIRST STRONG ISOLATE"],
    [0x2069, "POP DIRECTIONAL ISOLATE"],
    [0xfeff, "ZERO WIDTH NO-BREAK SPACE"],
    [0xfe0f, "VARIATION SELECTOR"],
    [0xe0100, "VARIATION SELECTOR"],
    [0xe0061, "UNICODE TAG"],
    [0x115f, "HANGUL CHOSEONG FILLER"],
    [0x1160, "HANGUL JUNGSEONG FILLER"],
    [0x3164, "HANGUL FILLER"],
    [0x2028, "LINE SEPARATOR"],
    [0x2029, "PARAGRAPH SEPARATOR"],
    [0x0007, "CONTROL CHARACTER"],
  ])("rejects U+%s with a readable name", (point, name) => {
    const issues = findUnicodeIssues(`first\nA${String.fromCodePoint(point)}B`);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ line: 2, column: 2, codePoint: expect.stringContaining(name) }),
      ]),
    );
  });

  it("reports non-NFC text without changing it", () => {
    const content = "Cafe\u0301";
    expect(findUnicodeIssues(content)).toContainEqual(
      expect.objectContaining({ line: 1, codePoint: "U+0065 CHARACTER", reason: "text is not NFC normalized" }),
    );
    expect(content).toBe("Cafe\u0301");
  });

  it("warns only for mixed-script URL hosts", () => {
    expect(findConfusableWarnings("https://exаmple.test/path")).toHaveLength(1);
    expect(findConfusableWarnings("日本語 Cyrillic а and https://example.test")).toEqual([]);
    expect(findConfusableWarnings("https://пример.example/path")).toEqual([]);
  });
});

describe("LLM security file selection", () => {
  it.each([
    "AGENTS.md",
    "apps/web/AGENTS.md",
    "apps/web/app/AGENTS.override.md",
    ".agents/skills/sample/SKILL.md",
    ".agents/README.md",
    ".codex/config.toml",
    "docs/README.md",
  ])("checks %s", (file) => expect(isSecurityTarget(file)).toBe(true));

  it.each(["src/app.ts", "README.md", "docs/image.png"])("skips %s", (file) => {
    expect(isSecurityTarget(file)).toBe(false);
  });

  it.each(["AGENTS.md", "apps/web/AGENTS.md", ".agents/skills/vercel-react-best-practices/AGENTS.md"])(
    "allows known instruction file %s",
    (file) => expect(instructionPathIssue(file)).toBeNull(),
  );

  it.each([
    "apps/web/app/example/AGENTS.md",
    "apps/web/app/example/AGENTS.override.md",
    ".agents/skills/nested/extra/SKILL.md",
    "docs/SKILL.md",
  ])("rejects unexpected instruction file %s", (file) => {
    expect(instructionPathIssue(file)).not.toBeNull();
  });
});

describe("LLM security CLI", () => {
  it("checks the staged index rather than unstaged worktree changes", () => {
    const directory = mkdtempSync(`${tmpdir()}/llm-security-`);
    try {
      spawnSync("git", ["init"], { cwd: directory });
      writeFileSync(`${directory}/AGENTS.md`, "Safe instructions\n");
      spawnSync("git", ["add", "AGENTS.md"], { cwd: directory });
      writeFileSync(`${directory}/AGENTS.md`, "Unsafe\u200b instructions\n");

      const staged = spawnSync(process.execPath, [script, "--staged"], { cwd: directory, encoding: "utf8" });
      const tracked = spawnSync(process.execPath, [script, "--tracked"], { cwd: directory, encoding: "utf8" });
      expect(staged.status).toBe(0);
      expect(tracked.status).toBe(1);
      expect(tracked.stderr).toContain("AGENTS.md:1:7: Forbidden Unicode character: U+200B ZERO WIDTH SPACE");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects newly staged instruction files in unexpected locations", () => {
    const directory = mkdtempSync(`${tmpdir()}/llm-security-`);
    try {
      spawnSync("git", ["init"], { cwd: directory });
      writeFileSync(`${directory}/AGENTS.override.md`, "Unexpected instructions\n");
      spawnSync("git", ["add", "AGENTS.override.md"], { cwd: directory });

      const result = spawnSync(process.execPath, [script, "--staged"], { cwd: directory, encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("AGENTS.override.md:1:1");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
