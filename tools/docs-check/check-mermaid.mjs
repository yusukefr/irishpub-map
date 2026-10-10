import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

if (typeof globalThis.window === "undefined") {
  const { window } = new JSDOM("");
  Object.assign(globalThis, {
    window,
    document: window.document,
    DOMParser: window.DOMParser,
    Element: window.Element,
    SVGElement: window.SVGElement,
  });
}

const { default: mermaid } = await import("mermaid");

/** Markdown文書中のMermaid fenceと、独立した `.mmd` ファイルを列挙します。 */
export function collectMermaidDiagrams(files, readFile = readFileSync) {
  const diagrams = [];

  for (const file of files) {
    const source = readFile(file, "utf8");
    if (/\.mmd$/i.test(file)) {
      diagrams.push({ file, line: 1, source });
      continue;
    }

    const lines = source.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const opening = lines[index].match(/^ {0,3}(`{3,}|~{3,})\s*mermaid(?:\s|$)/i);
      if (!opening) continue;

      const marker = opening[1];
      const closingPattern = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`);
      const start = index + 1;
      let end = start;
      while (end < lines.length && !closingPattern.test(lines[end])) end += 1;
      if (end === lines.length) {
        throw new Error(`${file}:${index + 1}: Mermaid code fence is not closed.`);
      }
      diagrams.push({ file, line: start + 1, source: lines.slice(start, end).join("\n") });
      index = end;
    }
  }

  return diagrams;
}

/** Mermaid parserで図の構文を検証し、ファイルと行を含むエラーを返します。 */
export async function validateMermaidDiagrams(diagrams, parseDiagram = mermaid.parse) {
  const errors = [];
  for (const diagram of diagrams) {
    try {
      await parseDiagram(diagram.source);
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
      errors.push(`${diagram.file}:${diagram.line}: ${message}`);
    }
  }
  return errors;
}

if (process.argv[1]?.endsWith("check-mermaid.mjs")) {
  const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((file) => /\.(?:md|mmd)$/i.test(file));
  const errors = await validateMermaidDiagrams(collectMermaidDiagrams(files));
  if (errors.length > 0) {
    process.stderr.write(`${errors.join("\n")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Validated ${collectMermaidDiagrams(files).length} Mermaid diagram(s).\n`);
  }
}
