import { readFile, readdir } from "node:fs/promises";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { Client } from "@neondatabase/serverless";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../apps/web/content/discover/guides");
const slugs = ["sample", "split-the-g"];
const locales = ["ja", "en"];
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMdx);
const allowedNodes = new Set([
  "root",
  "heading",
  "paragraph",
  "text",
  "list",
  "listItem",
  "link",
  "linkReference",
  "definition",
  "emphasis",
  "strong",
  "delete",
  "blockquote",
  "break",
  "thematicBreak",
  "code",
  "inlineCode",
  "table",
  "tableRow",
  "tableCell",
]);

/** 検証理由だけを保持し、DBやParserの例外に含まれる秘密情報をログへ流しません。 */
export class MigrationError extends Error {}
const fail = (reason) => {
  throw new MigrationError(reason);
};

function literal(node) {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "ArrayExpression") return node.elements.map(literal);
  fail("metadataには文字列と文字列配列だけを使用してください");
}

/**
 * MDXを評価せず、既知のmetadata exportと標準Markdown本文へ分離します。
 * @param {string} source - Trusted MDXファイルの原文。
 * @param {string} slug - 棚卸し済みpathのslug。
 * @param {string} locale - pathのlocale。
 * @returns {object} 検証済みmetadataと本文。
 */
export function parseGuide(source, slug, locale) {
  let tree;
  try {
    tree = parser.parse(source);
  } catch {
    fail("MDX構文が不正です");
  }
  const first = tree.children[0];
  const statement = first?.data?.estree?.body;
  if (first?.type !== "mdxjsEsm" || statement?.length !== 1) fail("先頭にmetadata exportが必要です");
  const declaration = statement[0].declaration;
  const variable = declaration?.declarations?.[0];
  if (
    statement[0].type !== "ExportNamedDeclaration" ||
    declaration?.kind !== "const" ||
    declaration.declarations.length !== 1 ||
    variable?.id?.name !== "metadata" ||
    variable.init?.type !== "ObjectExpression"
  )
    fail("metadata export形式が未対応です");
  const metadata = {};
  for (const property of variable.init.properties) {
    const key = property.key?.name ?? property.key?.value;
    if (
      property.type !== "Property" ||
      property.computed ||
      property.method ||
      property.shorthand ||
      property.kind !== "init" ||
      Object.hasOwn(metadata, key) ||
      !["slug", "kind", "title", "summary", "category", "tags", "publishedAt"].includes(key)
    )
      fail("metadataに重複または未対応項目があります");
    metadata[key] = literal(property.value);
  }
  if (metadata.slug !== slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    fail("slugがpathと不一致または不正です");
  if (
    !locales.includes(locale) ||
    metadata.kind !== "guide" ||
    !["history", "culture", "pub-culture", "food-drink"].includes(metadata.category)
  )
    fail("locale / kind / categoryが不正です");
  for (const [key, max] of [
    ["title", 200],
    ["summary", 500],
  ]) {
    if (typeof metadata[key] !== "string" || !metadata[key].trim() || metadata[key].length > max)
      fail(`${key}が空または上限超過です`);
  }
  const date = metadata.publishedAt;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail("publishedAtは日付が必要です");
  const time = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(time.valueOf()) || time.toISOString().slice(0, 10) !== date) fail("publishedAtが不正です");
  if (!Array.isArray(metadata.tags) || !metadata.tags.every((tag) => typeof tag === "string")) fail("tagsが不正です");
  const body = source.slice(first.position.end.offset).replace(/^(?:\r?\n)+/, "");
  if (!body.trim() || body.length > 100000) fail("本文が空または上限超過です");
  const pending = [...tree.children.slice(1)];
  while (pending.length) {
    const node = pending.pop();
    if (!allowedNodes.has(node.type)) fail(`未対応の本文表現: ${node.type}`);
    if (node.type === "listItem" && node.checked != null) fail("task listはRenderer未対応です");
    if (node.type === "text" && /(?:^|\n)\s*(?:import|export|const|let|var|function|class)\b/.test(node.value))
      fail("本文のJavaScript宣言は未対応です");
    if (["link", "definition"].includes(node.type)) {
      const url = node.url;
      let safe = (url.startsWith("/") && !url.startsWith("//")) || url.startsWith("#");
      try {
        safe ||= ["https:", "http:"].includes(new URL(url).protocol);
      } catch {
        /* 相対URLは上で判定します。 */
      }
      if (!safe) fail("許可されていないURLです");
    }
    pending.push(...(node.children ?? []));
  }
  return { ...metadata, publishedAt: time.toISOString(), locale, bodyMarkdown: body };
}

/**
 * 棚卸し済みファイルだけを読み、locale不足や追加ファイルを再棚卸し対象として拒否します。
 * @param {string} directory - Guideのルート。テスト時だけ差し替えます。
 * @returns {Promise<object[]>} 日英をまとめた移行データ。
 */
export async function loadGuides(directory = root) {
  const names = (await readdir(directory)).sort();
  if (JSON.stringify(names) !== JSON.stringify(slugs)) fail("Guide集合が棚卸し結果と異なります");
  const guides = [];
  for (const slug of slugs) {
    const files = (await readdir(join(directory, slug))).sort();
    if (JSON.stringify(files) !== JSON.stringify(["en.mdx", "ja.mdx"]))
      fail(`${slug}: ja/en以外または不足ファイルがあります`);
    const translations = {};
    let common;
    for (const locale of locales) {
      const path = join(directory, slug, `${locale}.mdx`);
      let item;
      try {
        item = parseGuide(await readFile(path, "utf8"), slug, locale);
      } catch (error) {
        fail(`${slug}/${locale}.mdx: ${error instanceof MigrationError ? error.message : "読込失敗"}`);
      }
      const shared = { kind: item.kind, slug, category: item.category, publishedAt: item.publishedAt, tags: item.tags };
      if (common && JSON.stringify(common) !== JSON.stringify(shared))
        fail(`${slug}/${locale}.mdx: 日英metadataが不一致です`);
      common = shared;
      translations[locale] = { title: item.title, summary: item.summary, bodyMarkdown: item.bodyMarkdown };
    }
    guides.push({ ...common, translations });
  }
  return guides;
}

async function compare(client, guide) {
  const { rows } = await client.query(
    "SELECT id, category, status, published_at FROM content_entries WHERE kind = $1 AND slug = $2",
    [guide.kind, guide.slug],
  );
  if (!rows.length) return null;
  const row = rows[0];
  const { rows: translations } = await client.query(
    "SELECT locale, title, summary, body_markdown FROM content_translations WHERE content_id = $1 ORDER BY locale",
    [row.id],
  );
  const matches =
    rows.length === 1 &&
    row.category === guide.category &&
    row.status === "published" &&
    new Date(row.published_at).toISOString() === guide.publishedAt &&
    translations.length === 2 &&
    translations.every((translation) => {
      const source = guide.translations[translation.locale];
      return (
        source &&
        source.title === translation.title &&
        source.summary === translation.summary &&
        source.bodyMarkdown === translation.body_markdown
      );
    });
  if (!matches) fail(`${guide.slug}: 既存DB Contentと不一致です（上書きしません）`);
  return row.id;
}

/**
 * 既存値をロック下で比較し、全Guideを単一transactionで投入します。dry-run/verifyは書き込みません。
 * @param {Client} client - 呼び出し元が接続・切断するClient。
 * @param {object[]} guides - loadGuidesで全件Validation済みのデータ。
 * @param {string} mode - dry-run / apply / verify。
 * @returns {Promise<object[]>} Commit後のGuideごとの結果。
 */
export async function migrateGuides(client, guides, mode) {
  if (!["dry-run", "apply", "verify"].includes(mode)) fail("modeが不正です");
  const results = [];
  await client.query(mode === "apply" ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    // 管理画面の同時更新も含め、比較からINSERT完了まで親子の更新を防ぎます。
    if (mode === "apply")
      await client.query("LOCK TABLE content_entries, content_translations IN SHARE ROW EXCLUSIVE MODE");
    for (const guide of guides) {
      const existing = await compare(client, guide);
      if (existing) {
        results.push({ slug: guide.slug, result: "SKIP" });
        continue;
      }
      if (mode === "verify") fail(`${guide.slug}: DBに存在しません`);
      if (mode === "apply") {
        const { rows } = await client.query(
          "INSERT INTO content_entries (kind, slug, category, status, published_at) VALUES ($1, $2, $3, 'published', $4) RETURNING id",
          [guide.kind, guide.slug, guide.category, guide.publishedAt],
        );
        for (const locale of locales) {
          const translation = guide.translations[locale];
          await client.query(
            "INSERT INTO content_translations (content_id, locale, title, summary, body_markdown) VALUES ($1, $2, $3, $4, $5)",
            [rows[0].id, locale, translation.title, translation.summary, translation.bodyMarkdown],
          );
        }
        await compare(client, guide);
      }
      results.push({ slug: guide.slug, result: mode === "apply" ? "ADDED" : "WOULD_ADD" });
    }
    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

/** 接続先を明示したときだけDBを利用し、例外の生データを表示しません。 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !["--validate", "--dry-run", "--apply", "--verify"].includes(args[0]))
    fail("Usage: node scripts/migrate-editorial-guides.mjs --validate|--dry-run|--apply|--verify");
  const guides = await loadGuides();
  console.log("[OK] source: 2 guides / ja: 2 / en: 2; Level B: 4; tags omitted (no content tag schema)");
  if (args[0] === "--validate") return;
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  if (!connectionString) fail("MIGRATION_DATABASE_URLが必要です");
  let connection;
  try {
    connection = new URL(connectionString);
  } catch {
    fail("DB接続設定が不正です");
  }
  if (!["postgres:", "postgresql:"].includes(connection.protocol) || connection.hostname.includes("-pooler"))
    fail("Direct / Unpooled接続が必要です");
  const client = new Client({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    const results = await migrateGuides(client, guides, args[0].slice(2));
    for (const item of results) console.log(`[${item.result}] ${item.slug} / ja,en`);
    console.log("[OK] updates: 0; errors: 0");
  } finally {
    await client.end();
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(
      `[ERROR] ${error instanceof MigrationError ? error.message : "DB接続またはtransaction失敗（秘密情報保護のため詳細省略）"}`,
    );
    process.exitCode = 1;
  });
}
