import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";
import { getTagLabel, normalizeTags } from "../packages/shared/src/tag.ts";

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

  return value.map((pub) => ({ ...pub, tags: normalizeTags(pub.tags) }));
}

/** Phase 4スキーマへ店舗と日本語翻訳を追加し、既存IDは更新せずにスキップします。 */
export async function importPubs(databaseUrl, pubs, sql) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const client = sql || neon(databaseUrl);

  let imported = 0;
  let skipped = 0;
  for (const pub of pubs) {
    const prefectureCode = PREFECTURE_NAMES.indexOf(pub.prefecture) + 1;
    const municipalityRows = await client`
      SELECT m.code
      FROM municipality_codes m
      JOIN municipality_translations mt ON mt.municipality_code = m.code AND mt.locale = ${"ja"}
      WHERE m.prefecture_code = ${prefectureCode} AND mt.name = ${pub.city ?? ""}
    `;
    if (municipalityRows.length !== 1) throw new Error(`Could not resolve municipality code for ${pub.id}.`);
    const rows = await client`
      INSERT INTO pubs (
        id, prefecture_code, municipality_code, latitude, longitude,
        website_url, google_maps_url, instagram_url, status_code
      ) VALUES (
        ${pub.id}::uuid, ${prefectureCode}, ${municipalityRows[0].code}, ${pub.latitude}, ${pub.longitude},
        ${toNullable(pub.websiteUrl)}, ${toNullable(pub.googleMapsUrl)},
        ${toNullable(pub.instagramUrl)}, ${PUB_STATUS_CODES[pub.status]}
      )
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;
    if (rows.length === 1) {
      imported += 1;
      await client`
        INSERT INTO pub_translations (pub_id, locale, name, name_reading, address)
        VALUES (${pub.id}::uuid, ${"ja"}, ${pub.name}, ${toNullable(pub.kana)}, ${pub.address})
      `;
      for (const tag of normalizeTags(pub.tags)) {
        const tagRows = await client`
          INSERT INTO tags (key)
          VALUES (${tag})
          ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key
          RETURNING id
        `;
        if (tagRows.length !== 1) throw new Error("Could not resolve tag master record.");
        await client`
          INSERT INTO tag_translations (tag_id, locale, name)
          VALUES (${tagRows[0].id}::uuid, ${"ja"}, ${getTagLabel(tag)})
          ON CONFLICT (tag_id, locale) DO UPDATE SET name = EXCLUDED.name
        `;
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
