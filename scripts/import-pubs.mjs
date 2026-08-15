import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

const DEFAULT_SOURCE_PATH = "pubs.json";
const PUB_STATUSES = new Set(["open", "temporarily_closed", "closed", "unknown"]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

  await client`
    CREATE TABLE IF NOT EXISTS pubs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL CHECK (btrim(name) <> ''),
      kana TEXT,
      prefecture TEXT NOT NULL CHECK (btrim(prefecture) <> ''),
      city TEXT,
      address TEXT NOT NULL CHECK (btrim(address) <> ''),
      latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
      longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
      website_url TEXT CHECK (website_url IS NULL OR website_url ~* '^https?://'),
      google_maps_url TEXT CHECK (google_maps_url IS NULL OR google_maps_url ~* '^https?://'),
      instagram_url TEXT CHECK (instagram_url IS NULL OR instagram_url ~* '^https?://'),
      tags TEXT[] NOT NULL DEFAULT '{}' CHECK (array_position(tags, NULL) IS NULL),
      status TEXT NOT NULL CHECK (status IN ('open', 'temporarily_closed', 'closed', 'unknown')),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await client`CREATE INDEX IF NOT EXISTS pubs_prefecture_name_idx ON pubs (prefecture, name)`;
  await client`CREATE INDEX IF NOT EXISTS pubs_city_idx ON pubs (city)`;
  await client`CREATE INDEX IF NOT EXISTS pubs_kana_idx ON pubs (kana)`;
  await client`CREATE INDEX IF NOT EXISTS pubs_status_idx ON pubs (status)`;
  await client`CREATE INDEX IF NOT EXISTS pubs_tags_gin_idx ON pubs USING GIN (tags)`;

  let imported = 0;
  let skipped = 0;
  for (const pub of pubs) {
    const rows = await client`
      INSERT INTO pubs (
        id, name, kana, prefecture, city, address, latitude, longitude,
        website_url, google_maps_url, instagram_url, tags, status
      ) VALUES (
        ${pub.id}::uuid, ${pub.name}, ${toNullable(pub.kana)}, ${pub.prefecture}, ${toNullable(pub.city)}, ${pub.address},
        ${pub.latitude}, ${pub.longitude}, ${toNullable(pub.websiteUrl)}, ${toNullable(pub.googleMapsUrl)},
        ${toNullable(pub.instagramUrl)}, ${pub.tags}, ${pub.status}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;
    if (rows.length === 1) imported += 1;
    else skipped += 1;
  }

  return { imported, skipped, total: pubs.length };
}

function isPub(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pub = value;

  return (
    UUID_PATTERN.test(pub.id) &&
    isNonEmptyString(pub.name) &&
    isOptionalKana(pub.kana) &&
    isNonEmptyString(pub.prefecture) &&
    isNonEmptyString(pub.address) &&
    isOptionalString(pub.city) &&
    isLatitude(pub.latitude) &&
    isLongitude(pub.longitude) &&
    isOptionalUrl(pub.websiteUrl) &&
    isOptionalUrl(pub.googleMapsUrl) &&
    isOptionalUrl(pub.instagramUrl) &&
    Array.isArray(pub.tags) &&
    pub.tags.every((tag) => typeof tag === "string") &&
    PUB_STATUSES.has(pub.status)
  );
}

function isOptionalString(value) {
  return value === undefined || value === null || typeof value === "string";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalUrl(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && (value.trim() === "" || /^https?:\/\//i.test(value.trim())))
  );
}

function toNullable(value) {
  const normalized = typeof value === "string" ? value.trim() : value;
  return normalized || null;
}

function isOptionalKana(value) {
  return value === undefined || typeof value === "string";
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
