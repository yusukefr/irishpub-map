// PR本文へデプロイバージョンを記載し、再実行時に同じ欄を更新できることを保証するテストです。
import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { readStdin, upsertAppVersionSection } from "../scripts/update-pr-app-version.mjs";

describe("update-pr-app-version", () => {
  it("reads a pull request body from standard input", async () => {
    await expect(readStdin(Readable.from(["## Summary", "\n\n- Change"]))).resolves.toBe("## Summary\n\n- Change");
  });

  it("appends a searchable app version section to a pull request body", () => {
    const body = upsertAppVersionSection("## Summary\n\n- Change", { version: "0.1.1", releaseDate: "2026-08-13" });

    expect(body).toContain("## App Version");
    expect(body).toContain("Deployed version: `v0.1.1`");
    expect(body).toContain("Release date: `2026-08-13 JST`");
  });

  it("replaces the previous version section instead of duplicating it", () => {
    const body =
      "## Summary\n\n<!-- app-version:start -->\n## App Version\n\n- Deployed version: `v0.1.1`\n- Release date: `2026-08-13 JST`\n<!-- app-version:end -->\n";
    const updated = upsertAppVersionSection(body, { version: "0.1.2", releaseDate: "2026-08-14" });

    expect(updated).toContain("Deployed version: `v0.1.2`");
    expect(updated).not.toContain("Deployed version: `v0.1.1`");
    expect(updated.match(/## App Version/g)).toHaveLength(1);
  });
});
