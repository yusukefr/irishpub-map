import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

const DEFAULT_SOURCE_PATH = "pubs.json";
const PUB_STATUSES = new Set(["open", "temporarily_closed", "closed", "unknown"]);
const PREFECTURE_NAMES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
];
const PREFECTURE_KANAS = [
  "ﾎｯｶｲﾄﾞｳ",
  "ｱｵﾓﾘｹﾝ",
  "ｲﾜﾃｹﾝ",
  "ﾐﾔｷﾞｹﾝ",
  "ｱｷﾀｹﾝ",
  "ﾔﾏｶﾞﾀｹﾝ",
  "ﾌｸｼﾏｹﾝ",
  "ｲﾊﾞﾗｷｹﾝ",
  "ﾄﾁｷﾞｹﾝ",
  "ｸﾞﾝﾏｹﾝ",
  "ｻｲﾀﾏｹﾝ",
  "ﾁﾊﾞｹﾝ",
  "ﾄｳｷｮｳﾄ",
  "ｶﾅｶﾞﾜｹﾝ",
  "ﾆｲｶﾞﾀｹﾝ",
  "ﾄﾔﾏｹﾝ",
  "ｲｼｶﾜｹﾝ",
  "ﾌｸｲｹﾝ",
  "ﾔﾏﾅｼｹﾝ",
  "ﾅｶﾞﾉｹﾝ",
  "ｷﾞﾌｹﾝ",
  "ｼｽﾞｵｶｹﾝ",
  "ｱｲﾁｹﾝ",
  "ﾐｴｹﾝ",
  "ｼｶﾞｹﾝ",
  "ｷｮｳﾄﾌ",
  "ｵｵｻｶﾌ",
  "ﾋｮｳｺﾞｹﾝ",
  "ﾅﾗｹﾝ",
  "ﾜｶﾔﾏｹﾝ",
  "ﾄｯﾄﾘｹﾝ",
  "ｼﾏﾈｹﾝ",
  "ｵｶﾔﾏｹﾝ",
  "ﾋﾛｼﾏｹﾝ",
  "ﾔﾏｸﾞﾁｹﾝ",
  "ﾄｸｼﾏｹﾝ",
  "ｶｶﾞﾜｹﾝ",
  "ｴﾋﾒｹﾝ",
  "ｺｳﾁｹﾝ",
  "ﾌｸｵｶｹﾝ",
  "ｻｶﾞｹﾝ",
  "ﾅｶﾞｻｷｹﾝ",
  "ｸﾏﾓﾄｹﾝ",
  "ｵｵｲﾀｹﾝ",
  "ﾐﾔｻﾞｷｹﾝ",
  "ｶｺﾞｼﾏｹﾝ",
  "ｵｷﾅﾜｹﾝ",
];
const PUB_STATUS_CODES = { open: 1, temporarily_closed: 2, closed: 3, unknown: 4 };

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

/** Neonの正規化された店舗・マスタ・タグテーブルへ追加し、既存IDは更新せずにスキップします。 */
export async function importPubs(databaseUrl, pubs, sql) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const client = sql || neon(databaseUrl);

  await client`
    CREATE TABLE IF NOT EXISTS pubs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL CHECK (btrim(name) <> ''),
      kana TEXT,
      prefecture_code SMALLINT NOT NULL,
      city TEXT,
      address TEXT NOT NULL CHECK (btrim(address) <> ''),
      latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
      longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
      website_url TEXT CHECK (website_url IS NULL OR website_url ~* '^https?://'),
      google_maps_url TEXT CHECK (google_maps_url IS NULL OR google_maps_url ~* '^https?://'),
      instagram_url TEXT CHECK (instagram_url IS NULL OR instagram_url ~* '^https?://'),
      status_code SMALLINT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await client`CREATE TABLE IF NOT EXISTS prefectures (code SMALLINT PRIMARY KEY, name TEXT NOT NULL UNIQUE, kana TEXT NOT NULL)`;
  await client`ALTER TABLE prefectures ADD COLUMN IF NOT EXISTS kana TEXT`;
  for (const [index, name] of PREFECTURE_NAMES.entries()) {
    await client`INSERT INTO prefectures (code, name, kana) VALUES (${index + 1}, ${name}, ${PREFECTURE_KANAS[index]}) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, kana = EXCLUDED.kana`;
  }
  await client`CREATE TABLE IF NOT EXISTS pub_statuses (code SMALLINT PRIMARY KEY, value TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL)`;
  const displayNames = { open: "営業中", temporarily_closed: "一時休業", closed: "閉店", unknown: "不明" };
  for (const [value, code] of Object.entries(PUB_STATUS_CODES)) {
    await client`INSERT INTO pub_statuses (code, value, display_name) VALUES (${code}, ${value}, ${displayNames[value]}) ON CONFLICT (code) DO UPDATE SET value = EXCLUDED.value, display_name = EXCLUDED.display_name`;
  }
  await client`ALTER TABLE pubs DROP CONSTRAINT IF EXISTS pubs_prefecture_code_fkey`;
  await client`ALTER TABLE pubs DROP CONSTRAINT IF EXISTS pubs_status_code_fkey`;
  await client`ALTER TABLE pubs ADD CONSTRAINT pubs_prefecture_code_fkey FOREIGN KEY (prefecture_code) REFERENCES prefectures(code)`;
  await client`ALTER TABLE pubs ADD CONSTRAINT pubs_status_code_fkey FOREIGN KEY (status_code) REFERENCES pub_statuses(code)`;
  await client`CREATE TABLE IF NOT EXISTS tags (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE CHECK (btrim(name) <> ''))`;
  await client`CREATE TABLE IF NOT EXISTS pub_tags (pub_id UUID NOT NULL REFERENCES pubs(id) ON DELETE CASCADE, tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY (pub_id, tag_id))`;
  await client`CREATE INDEX IF NOT EXISTS pubs_prefecture_code_name_idx ON pubs (prefecture_code, name)`;
  await client`CREATE INDEX IF NOT EXISTS pubs_city_idx ON pubs (city)`;
  await client`CREATE INDEX IF NOT EXISTS pubs_kana_idx ON pubs (kana)`;
  await client`CREATE INDEX IF NOT EXISTS pubs_status_code_idx ON pubs (status_code)`;
  await client`CREATE INDEX IF NOT EXISTS pub_tags_tag_id_idx ON pub_tags (tag_id)`;

  let imported = 0;
  let skipped = 0;
  for (const pub of pubs) {
    const rows = await client`
      INSERT INTO pubs (
        id, name, kana, prefecture_code, city, address, latitude, longitude,
        website_url, google_maps_url, instagram_url, status_code
      ) VALUES (
        ${pub.id}::uuid, ${pub.name}, ${toNullable(pub.kana)}, ${PREFECTURE_NAMES.indexOf(pub.prefecture) + 1}, ${toNullable(pub.city)}, ${pub.address},
        ${pub.latitude}, ${pub.longitude}, ${toNullable(pub.websiteUrl)}, ${toNullable(pub.googleMapsUrl)},
        ${toNullable(pub.instagramUrl)}, ${PUB_STATUS_CODES[pub.status]}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;
    if (rows.length === 1) {
      imported += 1;
      for (const tag of new Set(pub.tags.map((item) => item.trim()).filter(Boolean))) {
        const tagRows = await client`
          INSERT INTO tags (name)
          VALUES (${tag})
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `;
        if (tagRows.length !== 1) throw new Error("Could not resolve tag master record.");
        await client`INSERT INTO pub_tags (pub_id, tag_id) VALUES (${pub.id}::uuid, ${tagRows[0].id}::uuid) ON CONFLICT (pub_id, tag_id) DO NOTHING`;
      }
    } else {
      skipped += 1;
    }
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
    pub.tags.every((tag) => isNonEmptyString(tag)) &&
    PREFECTURE_NAMES.includes(pub.prefecture) &&
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
