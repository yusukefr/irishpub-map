import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ALLOWED_AGENT_FILES = new Set([
  "AGENTS.md",
  "apps/web/AGENTS.md",
  ".agents/skills/vercel-react-best-practices/AGENTS.md",
]);
const ALLOWED_SKILL_FILES = new Set([
  ".agents/skills/agent-browser/SKILL.md",
  ".agents/skills/frontend-design/SKILL.md",
  ".agents/skills/gh-address-comments/SKILL.md",
  ".agents/skills/gh-fix-ci/SKILL.md",
  ".agents/skills/neon-postgres-branches/SKILL.md",
  ".agents/skills/neon-postgres/SKILL.md",
  ".agents/skills/neon/SKILL.md",
  ".agents/skills/next-best-practices/SKILL.md",
  ".agents/skills/next-cache-components/SKILL.md",
  ".agents/skills/vercel-deploy/SKILL.md",
  ".agents/skills/vercel-react-best-practices/SKILL.md",
  ".agents/skills/web-design-guidelines/SKILL.md",
  ".agents/skills/web-test-workflow/SKILL.md",
]);
const FORBIDDEN_INVISIBLE = /[\u034f\u115f-\u1160\u17b4-\u17b5\u2800\u3164\uffa0\u2028\u2029]/u;
const VARIATION_SELECTOR = /[\ufe00-\ufe0f\u{e0100}-\u{e01ef}]/u;
const UNICODE_TAG = /[\u{e0000}-\u{e007f}]/u;
const CHARACTER_NAMES = new Map([
  [0x034f, "COMBINING GRAPHEME JOINER"],
  [0x115f, "HANGUL CHOSEONG FILLER"],
  [0x1160, "HANGUL JUNGSEONG FILLER"],
  [0x17b4, "KHMER VOWEL INHERENT AQ"],
  [0x17b5, "KHMER VOWEL INHERENT AA"],
  [0x200b, "ZERO WIDTH SPACE"],
  [0x200c, "ZERO WIDTH NON-JOINER"],
  [0x200d, "ZERO WIDTH JOINER"],
  [0x2028, "LINE SEPARATOR"],
  [0x2029, "PARAGRAPH SEPARATOR"],
  [0x202a, "LEFT-TO-RIGHT EMBEDDING"],
  [0x202b, "RIGHT-TO-LEFT EMBEDDING"],
  [0x202c, "POP DIRECTIONAL FORMATTING"],
  [0x202d, "LEFT-TO-RIGHT OVERRIDE"],
  [0x202e, "RIGHT-TO-LEFT OVERRIDE"],
  [0x2060, "WORD JOINER"],
  [0x2066, "LEFT-TO-RIGHT ISOLATE"],
  [0x2067, "RIGHT-TO-LEFT ISOLATE"],
  [0x2068, "FIRST STRONG ISOLATE"],
  [0x2069, "POP DIRECTIONAL ISOLATE"],
  [0x2800, "BRAILLE PATTERN BLANK"],
  [0x3164, "HANGUL FILLER"],
  [0xfeff, "ZERO WIDTH NO-BREAK SPACE"],
  [0xffa0, "HALFWIDTH HANGUL FILLER"],
]);

/** Git 管理下のAgent向け文書と、配置を制限するinstruction fileを選びます。 */
export function isSecurityTarget(file) {
  const name = file.split("/").at(-1);
  return (
    name === "AGENTS.md" ||
    name === "AGENTS.override.md" ||
    name === "SKILL.md" ||
    (file.startsWith(".agents/") && file.endsWith(".md")) ||
    file.startsWith(".codex/") ||
    (file.startsWith("docs/") && file.endsWith(".md"))
  );
}

/** 既知のinstruction fileのみを許可し、新たな配置はレビューで明示的に追加します。 */
export function instructionPathIssue(file) {
  const name = file.split("/").at(-1);
  if (name === "AGENTS.override.md") return "AGENTS.override.md is not allowlisted";
  if (name === "AGENTS.md" && !ALLOWED_AGENT_FILES.has(file)) return "AGENTS.md is not allowlisted";
  if (name === "SKILL.md" && !ALLOWED_SKILL_FILES.has(file)) return "SKILL.md is not allowlisted";
  return null;
}

function codePointLabel(character) {
  const point = character.codePointAt(0);
  const number = `U+${point.toString(16).toUpperCase().padStart(4, "0")}`;
  const name =
    CHARACTER_NAMES.get(point) ??
    (VARIATION_SELECTOR.test(character) ? "VARIATION SELECTOR" : null) ??
    (UNICODE_TAG.test(character) ? "UNICODE TAG" : null) ??
    (/\p{Cf}/u.test(character) ? "FORMAT CHARACTER" : null) ??
    (/\p{Cc}/u.test(character) ? "CONTROL CHARACTER" : null) ??
    "CHARACTER";
  return `${number} ${name}`;
}

function forbiddenReason(character) {
  if (VARIATION_SELECTOR.test(character)) return "variation selector";
  if (UNICODE_TAG.test(character)) return "Unicode tag";
  if (FORBIDDEN_INVISIBLE.test(character)) return "invisible, blank, or line separator";
  if (/\p{Cf}/u.test(character)) return "Unicode format character";
  if (/\p{Cc}/u.test(character) && !/[\t\n\r]/u.test(character)) return "control character";
  return null;
}

function positionAt(content, offset) {
  let line = 1;
  let column = 1;
  for (const character of content.slice(0, offset)) {
    if (character === "\n") {
      line += 1;
      column = 1;
    } else if (character !== "\r") {
      column += 1;
    }
  }
  return { line, column };
}

/** Unicodeの禁止文字とNFC違反を、自動修正せず位置付きで報告します。 */
export function findUnicodeIssues(content) {
  const findings = [];
  let line = 1;
  let column = 1;
  for (const character of content) {
    const reason = forbiddenReason(character);
    if (reason) findings.push({ line, column, codePoint: codePointLabel(character), reason });
    if (character === "\n") {
      line += 1;
      column = 1;
    } else if (character !== "\r") {
      column += 1;
    }
  }

  const normalized = content.normalize("NFC");
  if (normalized !== content) {
    let offset = 0;
    while (offset < content.length && content[offset] === normalized[offset]) offset += 1;
    const { line: issueLine, column: issueColumn } = positionAt(content, offset);
    findings.push({
      line: issueLine,
      column: issueColumn,
      codePoint: codePointLabel(String.fromCodePoint(content.codePointAt(offset))),
      reason: "text is not NFC normalized",
    });
  }
  return findings;
}

/** URLのhostnameだけを対象に、LatinとGreek/Cyrillicの混在を警告します。 */
export function findConfusableWarnings(content) {
  const warnings = [];
  for (const match of content.matchAll(/https?:\/\/([^\s/?#)<>]+)/gu)) {
    const host = match[1].split(":")[0];
    const mixedLabel = host
      .split(".")
      .some((label) => /[a-z]/iu.test(label) && /[\p{Script=Greek}\p{Script=Cyrillic}]/u.test(label));
    if (!mixedLabel) continue;
    const { line, column } = positionAt(content, match.index);
    warnings.push({ line, column, reason: "URL hostname mixes Latin and Greek/Cyrillic scripts" });
  }
  return warnings;
}

function gitFiles(args) {
  return execFileSync("git", args).toString("utf8").split("\0").filter(Boolean);
}

function contentFor(file, staged) {
  const bytes = staged ? execFileSync("git", ["show", `:${file}`]) : readFileSync(file);
  // BOMを除去するとファイル先頭の禁止文字 U+FEFF を見逃すため、文字として保持します。
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
}

function check(mode) {
  const staged = mode === "--staged";
  const files = gitFiles(
    staged ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"] : ["ls-files", "--cached", "-z"],
  ).filter(isSecurityTarget);
  let failures = 0;
  for (const file of files) {
    const pathIssue = instructionPathIssue(file);
    if (pathIssue) {
      console.error(`${file}:1:1: ${pathIssue}`);
      failures += 1;
    }
    let content;
    try {
      content = contentFor(file, staged);
    } catch (error) {
      console.error(`${file}:1:1: cannot read UTF-8 content: ${error.message}`);
      failures += 1;
      continue;
    }
    for (const issue of findUnicodeIssues(content)) {
      const label =
        issue.reason === "text is not NFC normalized" ? "NFC normalization required" : "Forbidden Unicode character";
      console.error(`${file}:${issue.line}:${issue.column}: ${label}: ${issue.codePoint} (${issue.reason})`);
      failures += 1;
    }
    for (const warning of findConfusableWarnings(content)) {
      console.warn(`${file}:${warning.line}:${warning.column}: Warning: ${warning.reason}`);
    }
  }
  if (failures > 0) process.exitCode = 1;
  else console.log(`LLM security check passed (${files.length} files).`);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  const mode = process.argv[2] ?? "--tracked";
  if (!["--tracked", "--staged"].includes(mode) || process.argv.length > 3) {
    console.error("Usage: node scripts/check-llm-security.mjs [--tracked|--staged]");
    process.exitCode = 2;
  } else {
    check(mode);
  }
}
