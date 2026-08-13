import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

const DEFAULT_SOURCE_PATH = "pubs.json";
const PUB_STATUSES = new Set(["open", "temporarily_closed", "closed", "unknown"]);

/** コマンドライン引数からインポート元のJSONファイルパスを取得します。 */
export function getSourcePath(args) {
  if (args.length > 1) throw new Error("Usage: node scripts/import-pubs.mjs [pubs.json]");
  return args[0] || DEFAULT_SOURCE_PATH;
}

/** JSON入力を店舗データとして検証し、ID重複を含む不正な入力を拒否します。 */
export function parsePubs(value) {
  if (!Array.isArray(value)) throw new Error("Pub data must be an array.");

  const ids = new Set();
  for (const pub of value) {
    if (!isPub(pub) || ids.has(pub.id)) throw new Error("Invalid pub data found.");
    ids.add(pub.id);
  }

  return value;
}

/** Neonのpubsテーブルへ追加し、既存IDは更新せずにスキップします。 */
export async function importPubs(databaseUrl, pubs, sql) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const client = sql || neon(databaseUrl);

  await client`CREATE TABLE IF NOT EXISTS pubs (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;

  let imported = 0;
  let skipped = 0;
  for (const pub of pubs) {
    const rows = await client`INSERT INTO pubs (id, data) VALUES (${pub.id}, ${JSON.stringify(pub)}::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id`;
    if (rows.length === 1) imported += 1;
    else skipped += 1;
  }

  return { imported, skipped, total: pubs.length };
}

function isPub(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pub = value;

  return (
    typeof pub.id === "string" &&
    typeof pub.name === "string" &&
    typeof pub.prefecture === "string" &&
    typeof pub.address === "string" &&
    isOptionalString(pub.city) &&
    isLatitude(pub.latitude) &&
    isLongitude(pub.longitude) &&
    isOptionalString(pub.websiteUrl) &&
    isOptionalString(pub.googleMapsUrl) &&
    isOptionalString(pub.instagramUrl) &&
    Array.isArray(pub.tags) &&
    pub.tags.every((tag) => typeof tag === "string") &&
    PUB_STATUSES.has(pub.status)
  );
}

function isOptionalString(value) {
  return value === undefined || value === null || typeof value === "string";
}

function isLatitude(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLongitude(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

async function main() {
  const sourcePath = getSourcePath(process.argv.slice(2));
  const pubs = parsePubs(JSON.parse(await readFile(sourcePath, "utf8")));
  const result = await importPubs(process.env.DATABASE_URL, pubs);
  console.log(`Imported ${result.imported}, skipped ${result.skipped}, total ${result.total}: ${sourcePath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
