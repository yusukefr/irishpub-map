// @vitest-environment node
import { readFile, mkdtemp, cp, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadGuides, parseGuide } from "../scripts/migrate-editorial-guides.mjs";
import { hasOnlySafeMarkdownUrls } from "../apps/web/app/lib/content/validation";

const sourceRoot = "apps/web/content/discover/guides";
const sample = await readFile(`${sourceRoot}/sample/ja.mdx`, "utf8");
const metadata = sample.slice(0, sample.indexOf("};") + 2);

describe("Guide migration source validation", () => {
  it("4ファイルのmetadata exportだけを除き本文・日英・公開日を保持する", async () => {
    const guides = await loadGuides();
    expect(guides.map((g) => g.slug)).toEqual(["sample", "split-the-g"]);
    for (const guide of guides) {
      expect(Object.keys(guide.translations)).toEqual(["ja", "en"]);
      for (const locale of ["ja", "en"]) {
        const source = await readFile(`${sourceRoot}/${guide.slug}/${locale}.mdx`, "utf8");
        const translation = guide.translations[locale];
        expect(translation.bodyMarkdown).toBe(source.split("};\n\n")[1]);
        expect(source).toContain(`title: "${translation.title}"`);
        expect(source).toContain(`summary: "${translation.summary}"`);
        expect(hasOnlySafeMarkdownUrls(translation.bodyMarkdown)).toBe(true);
      }
      expect(guide.publishedAt).toMatch(/T00:00:00.000Z$/);
    }
  });

  it("標準MarkdownのHeading / List / Quote / Link / Codeを改変しない", () => {
    const body =
      "## Heading\n\n1. Item\n\n> Quote\n\n[Map](/) [safe](https://example.com)\n\n```js\nconst sample = 1;\n```\n";
    expect(parseGuide(`${metadata}\n\n${body}`, "sample", "ja").bodyMarkdown).toBe(body);
  });

  it.each([
    "import Widget from './widget'",
    "export const hidden = 1",
    "<Widget />",
    "{process.env.SECRET}",
    "<div>HTML</div>",
    "<!-- hidden -->",
    "![image](/image.png)",
    "- [x] task",
    "[unsafe](javascript:alert%281%29)",
    "[unsafe][ref]\n\n[ref]: data:text/html,hello",
    "[unsafe](//example.com)",
    "const value = 1;",
  ])("未対応本文を拒否する: %s", (body) => {
    expect(() => parseGuide(`${metadata}\n\n${body}`, "sample", "ja")).toThrow();
  });

  it.each([
    ['title: "サンプルガイド"', 'title: ""'],
    ['category: "culture"', 'category: "other"'],
    ['publishedAt: "2026-09-02"', 'publishedAt: "2026-02-30"'],
    ['slug: "sample"', 'slug: "other"'],
    ['kind: "guide"', 'kind: "story"'],
    ['title: "サンプルガイド"', "title: process.env.SECRET"],
    ['title: "サンプルガイド"', 'title: "one", title: "two"'],
    ['title: "サンプルガイド"', 'get title() { return "title"; }'],
  ])("不正metadataを評価せず拒否する", (before, after) => {
    expect(() => parseGuide(sample.replace(before, after), "sample", "ja")).toThrow();
  });

  it("空本文、未知locale、metadataなしを拒否する", () => {
    expect(() => parseGuide(metadata, "sample", "ja")).toThrow();
    expect(() => parseGuide(sample, "sample", "fr")).toThrow();
    expect(() => parseGuide("# Body", "sample", "ja")).toThrow();
  });

  it("locale不足・未棚卸しファイル・日英不一致をファイル名付きで拒否する", async () => {
    const dir = await mkdtemp(join(tmpdir(), "guide-migration-test-"));
    try {
      await cp(sourceRoot, dir, { recursive: true });
      await writeFile(join(dir, "sample/en.mdx"), sample.replace('category: "culture"', 'category: "history"'));
      await expect(loadGuides(dir)).rejects.toThrow("sample/en.mdx: 日英metadata");
      await rm(join(dir, "sample/en.mdx"));
      await expect(loadGuides(dir)).rejects.toThrow("sample: ja/en");
      await writeFile(join(dir, "unknown.mdx"), sample);
      await expect(loadGuides(dir)).rejects.toThrow("Guide集合");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("Guide migration CLI", () => {
  it("既定DBや秘密情報を表示せず、明示的なDirect接続を要求する", () => {
    for (const connection of ["", "invalid-secret-connection", "postgresql://ep-test-pooler.example/db"]) {
      const result = spawnSync(process.execPath, ["scripts/migrate-editorial-guides.mjs", "--dry-run"], {
        env: { ...process.env, MIGRATION_DATABASE_URL: connection },
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).not.toContain("invalid-secret-connection");
      expect(result.stderr).toContain("[ERROR]");
    }
  });
  it("未知の引数は書き込み前に拒否する", () => {
    const result = spawnSync(process.execPath, ["scripts/migrate-editorial-guides.mjs", "--force"], {
      env: { ...process.env, MIGRATION_DATABASE_URL: "" },
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage:");
  });
});
