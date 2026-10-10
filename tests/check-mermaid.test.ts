import { describe, expect, it } from "vitest";
import { collectMermaidDiagrams, validateMermaidDiagrams } from "../tools/docs-check/check-mermaid.mjs";

describe("Mermaid documentation checks", () => {
  it("collects backtick fences, tilde fences, and standalone mmd files", () => {
    const contents = new Map([
      [
        "docs/example.md",
        "Text\n~~~mermaid title\nflowchart LR\n  A --> B\n~~~\n```mermaid\nsequenceDiagram\n  A->>B: hello\n```\n",
      ],
      ["docs/standalone.mmd", "flowchart TD\n  A --> B\n"],
      ["docs/UPPERCASE.MMD", "flowchart TD\n  A --> C\n"],
    ]);
    const diagrams = collectMermaidDiagrams([...contents.keys()], (path) => contents.get(path) ?? "");

    expect(diagrams).toEqual([
      { file: "docs/example.md", line: 3, source: "flowchart LR\n  A --> B" },
      { file: "docs/example.md", line: 7, source: "sequenceDiagram\n  A->>B: hello" },
      { file: "docs/standalone.mmd", line: 1, source: "flowchart TD\n  A --> B\n" },
      { file: "docs/UPPERCASE.MMD", line: 1, source: "flowchart TD\n  A --> C\n" },
    ]);
  });

  it("reports malformed fences and Mermaid syntax errors", async () => {
    expect(() => collectMermaidDiagrams(["docs/broken.md"], () => "```mermaid\nflowchart LR\n")).toThrow(
      "docs/broken.md:1: Mermaid code fence is not closed",
    );

    const errors = await validateMermaidDiagrams([
      { file: "docs/broken.md", line: 4, source: "flowchart LR\n  A -->" },
    ]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/^docs\/broken\.md:4:/);
  });

  it("accepts valid diagram syntax", async () => {
    await expect(
      validateMermaidDiagrams([{ file: "docs/valid.mmd", line: 1, source: "flowchart LR\n  A --> B" }]),
    ).resolves.toEqual([]);
  });
});
