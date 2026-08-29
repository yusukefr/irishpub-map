import { neon } from "@neondatabase/serverless";
import type { AdminPub, AdminPubFieldErrors, AdminPubWriteInput } from "@irishpub-map/shared/admin-pub";
import type { PubStatus } from "@irishpub-map/shared/pub";

type DbRow = Record<string, unknown>;

/** 入力が参照するマスタをDB上で検証した結果です。 */
export type AdminPubReferenceResult = {
  fieldErrors: AdminPubFieldErrors;
  statusCode: number | null;
};

/** 更新transactionの業務結果です。 */
export type AdminPubUpdateResult = "updated" | "not_found" | "publication_blocked";

let sqlClient: ReturnType<typeof neon> | null = null;

/**
 * 管理店舗詳細を、NULL可能属性、日英翻訳、タグIDを含む編集用DTOで取得します。
 * @param {string} id - 取得対象店舗のUUID。
 * @returns {Promise<AdminPub | null>} 管理店舗詳細。対象が存在しない場合はnull。
 */
export async function getAdminPub(id: string): Promise<AdminPub | null> {
  const rows = (await getRequiredSql()`
    SELECT pub.id::text, pub.is_published, pub.prefecture_code, pub.municipality_code,
      pub.latitude, pub.longitude, pub.website_url, pub.google_maps_url, pub.instagram_url,
      status.key AS status_key, pub.updated_at,
      ja.name AS name_ja, ja.name_reading AS name_reading_ja, ja.address AS address_ja,
      en.name AS name_en, en.name_reading AS name_reading_en, en.address AS address_en,
      COALESCE(
        array_agg(pub_tag.tag_id::text ORDER BY pub_tag.tag_id)
          FILTER (WHERE pub_tag.tag_id IS NOT NULL),
        '{}'
      ) AS tag_ids
    FROM pubs AS pub
    JOIN pub_translations AS ja ON ja.pub_id = pub.id AND ja.locale = 'ja'
    LEFT JOIN pub_translations AS en ON en.pub_id = pub.id AND en.locale = 'en'
    LEFT JOIN pub_statuses AS status ON status.code = pub.status_code
    LEFT JOIN pub_tags AS pub_tag ON pub_tag.pub_id = pub.id
    WHERE pub.id = ${id}::uuid
    GROUP BY pub.id, status.key, ja.name, ja.name_reading, ja.address,
      en.name, en.name_reading, en.address
  `) as DbRow[];
  if (rows.length === 0) return null;
  if (rows.length !== 1) throw new Error("Invalid admin pub detail result.");
  return toAdminPub(rows[0]);
}

/**
 * 入力が参照する都道府県、市区町村、営業状態、タグと日本語表示名の存在を検証します。
 * @param {AdminPubWriteInput} input - 構文検証済みの店舗入力。
 * @returns {Promise<AdminPubReferenceResult>} フィールド別参照エラーと解決済み営業状態コード。
 */
export async function validateAdminPubReferences(input: AdminPubWriteInput): Promise<AdminPubReferenceResult> {
  const tagIdsJson = JSON.stringify(input.tagIds);
  const rows = (await getRequiredSql()`
    SELECT
      (
        ${input.prefectureCode}::smallint IS NULL
        OR EXISTS (
          SELECT 1 FROM prefectures AS prefecture
          JOIN prefecture_translations AS translation
            ON translation.prefecture_code = prefecture.code
            AND translation.locale = 'ja' AND btrim(translation.name) <> ''
          WHERE prefecture.code = ${input.prefectureCode}
        )
      ) AS prefecture_valid,
      (
        ${input.municipalityCode}::text IS NULL
        OR EXISTS (
          SELECT 1 FROM municipality_codes AS municipality
          JOIN municipality_translations AS translation
            ON translation.municipality_code = municipality.code
            AND translation.locale = 'ja' AND btrim(translation.name) <> ''
          WHERE municipality.code = ${input.municipalityCode}
            AND municipality.prefecture_code = ${input.prefectureCode}
        )
      ) AS municipality_valid,
      (
        ${input.status}::text IS NULL
        OR EXISTS (
          SELECT 1 FROM pub_statuses AS status
          JOIN pub_status_translations AS translation
            ON translation.status_code = status.code
            AND translation.locale = 'ja' AND btrim(translation.display_name) <> ''
          WHERE status.key = ${input.status}
        )
      ) AS status_valid,
      NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(${tagIdsJson}::jsonb) AS requested(id)
        WHERE NOT EXISTS (
          SELECT 1 FROM tags AS tag
          JOIN tag_translations AS translation
            ON translation.tag_id = tag.id
            AND translation.locale = 'ja' AND btrim(translation.name) <> ''
          WHERE tag.id = requested.id::uuid
        )
      ) AS tags_valid,
      (SELECT status.code FROM pub_statuses AS status WHERE status.key = ${input.status}) AS status_code
  `) as DbRow[];
  if (rows.length !== 1) throw new Error("Invalid admin pub reference validation result.");

  const row = rows[0];
  const fieldErrors: AdminPubFieldErrors = {};
  if (!requiredBoolean(row.prefecture_valid)) fieldErrors.prefectureCode = "invalid_format";
  if (!requiredBoolean(row.municipality_valid)) fieldErrors.municipalityCode = "invalid_format";
  if (!requiredBoolean(row.status_valid)) fieldErrors.status = "invalid_format";
  if (!requiredBoolean(row.tags_valid)) fieldErrors.tagIds = "invalid_format";
  return { fieldErrors, statusCode: nullableInteger(row.status_code) };
}

/**
 * 店舗本体、必須の日本語翻訳、任意の英語翻訳、既存タグ関係を単一transactionで作成します。
 * @param {string} id - Application Serviceで発行した店舗UUID。
 * @param {AdminPubWriteInput} input - 構文・参照検証済みの下書き入力。
 * @param {number | null} statusCode - DBマスタから解決した営業状態コード。
 * @returns {Promise<void>} transactionが完了した場合に解決します。
 */
export async function insertAdminPub(id: string, input: AdminPubWriteInput, statusCode: number | null): Promise<void> {
  const sql = getRequiredSql();
  await sql.transaction(
    (transaction) => {
      const queries = [
        transaction`
          INSERT INTO pubs (
            id, prefecture_code, municipality_code, latitude, longitude,
            website_url, google_maps_url, instagram_url, status_code, is_published
          )
          VALUES (
            ${id}::uuid, ${input.prefectureCode}, ${input.municipalityCode},
            ${input.latitude}, ${input.longitude}, ${input.websiteUrl},
            ${input.googleMapsUrl}, ${input.instagramUrl}, ${statusCode}, FALSE
          )
        `,
        transaction`
          INSERT INTO pub_translations (pub_id, locale, name, name_reading, address)
          VALUES (
            ${id}::uuid, 'ja', ${input.translations.ja.name},
            ${input.translations.ja.nameReading}, ${input.translations.ja.address}
          )
        `,
      ];
      if (input.translations.en) {
        queries.push(
          transaction`
            INSERT INTO pub_translations (pub_id, locale, name, name_reading, address)
            VALUES (
              ${id}::uuid, 'en', ${input.translations.en.name},
              ${input.translations.en.nameReading}, ${input.translations.en.address}
            )
          `,
        );
      }
      for (const tagId of input.tagIds) {
        queries.push(transaction`INSERT INTO pub_tags (pub_id, tag_id) VALUES (${id}::uuid, ${tagId}::uuid)`);
      }
      return queries;
    },
    { isolationLevel: "ReadCommitted" },
  );
}

/**
 * 公開状態を維持したまま、店舗本体、翻訳、タグ関係を単一transactionで全体更新します。
 * @param {string} id - 更新対象店舗のUUID。
 * @param {AdminPubWriteInput} input - 構文・参照検証済み入力。
 * @param {number | null} statusCode - DBマスタから解決した営業状態コード。
 * @param {boolean} publishReady - 更新後入力がPublish Validationを満たす場合はtrue。
 * @returns {Promise<AdminPubUpdateResult>} 更新、対象なし、公開条件拒否のいずれか。
 */
export async function replaceAdminPub(
  id: string,
  input: AdminPubWriteInput,
  statusCode: number | null,
  publishReady: boolean,
): Promise<AdminPubUpdateResult> {
  const sql = getRequiredSql();
  const [lockedRows, updatedRows] = (await sql.transaction(
    (transaction) => {
      const queries = [
        transaction`SELECT id FROM pubs WHERE id = ${id}::uuid FOR UPDATE`,
        transaction`
          UPDATE pubs AS pub
          SET prefecture_code = ${input.prefectureCode},
            municipality_code = ${input.municipalityCode},
            latitude = ${input.latitude}, longitude = ${input.longitude},
            website_url = ${input.websiteUrl}, google_maps_url = ${input.googleMapsUrl},
            instagram_url = ${input.instagramUrl}, status_code = ${statusCode}, updated_at = NOW()
          WHERE pub.id = ${id}::uuid AND (NOT pub.is_published OR ${publishReady})
          RETURNING pub.id
        `,
        transaction`
          INSERT INTO pub_translations (pub_id, locale, name, name_reading, address)
          SELECT ${id}::uuid, 'ja', ${input.translations.ja.name},
            ${input.translations.ja.nameReading}, ${input.translations.ja.address}
          WHERE EXISTS (
            SELECT 1 FROM pubs AS pub
            WHERE pub.id = ${id}::uuid AND (NOT pub.is_published OR ${publishReady})
          )
          ON CONFLICT (pub_id, locale) DO UPDATE
          SET name = EXCLUDED.name, name_reading = EXCLUDED.name_reading,
            address = EXCLUDED.address, updated_at = NOW()
        `,
        input.translations.en
          ? transaction`
              INSERT INTO pub_translations (pub_id, locale, name, name_reading, address)
              SELECT ${id}::uuid, 'en', ${input.translations.en.name},
                ${input.translations.en.nameReading}, ${input.translations.en.address}
              WHERE EXISTS (
                SELECT 1 FROM pubs AS pub
                WHERE pub.id = ${id}::uuid AND (NOT pub.is_published OR ${publishReady})
              )
              ON CONFLICT (pub_id, locale) DO UPDATE
              SET name = EXCLUDED.name, name_reading = EXCLUDED.name_reading,
                address = EXCLUDED.address, updated_at = NOW()
            `
          : transaction`
              DELETE FROM pub_translations AS translation
              WHERE translation.pub_id = ${id}::uuid AND translation.locale = 'en'
                AND EXISTS (
                  SELECT 1 FROM pubs AS pub
                  WHERE pub.id = ${id}::uuid AND (NOT pub.is_published OR ${publishReady})
                )
            `,
        transaction`
          DELETE FROM pub_tags AS pub_tag
          WHERE pub_tag.pub_id = ${id}::uuid
            AND EXISTS (
              SELECT 1 FROM pubs AS pub
              WHERE pub.id = ${id}::uuid AND (NOT pub.is_published OR ${publishReady})
            )
        `,
      ];
      for (const tagId of input.tagIds) {
        queries.push(
          transaction`
            INSERT INTO pub_tags (pub_id, tag_id)
            SELECT ${id}::uuid, ${tagId}::uuid
            WHERE EXISTS (
              SELECT 1 FROM pubs AS pub
              WHERE pub.id = ${id}::uuid AND (NOT pub.is_published OR ${publishReady})
            )
          `,
        );
      }
      return queries;
    },
    { isolationLevel: "ReadCommitted" },
  )) as [DbRow[], DbRow[], ...DbRow[][]];

  if (lockedRows.length === 0) return "not_found";
  return updatedRows.length === 1 ? "updated" : "publication_blocked";
}

/**
 * 店舗を削除し、翻訳とタグ関係はFKのCASCADEへ委ねます。
 * @param {string} id - 削除対象店舗のUUID。
 * @returns {Promise<boolean>} 店舗を削除できた場合はtrue。
 */
export async function removeAdminPub(id: string): Promise<boolean> {
  const rows = (await getRequiredSql()`DELETE FROM pubs WHERE id = ${id}::uuid RETURNING id`) as DbRow[];
  return rows.length === 1;
}

function getRequiredSql() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  sqlClient ??= neon(process.env.DATABASE_URL);
  return sqlClient;
}

function toAdminPub(row: DbRow): AdminPub {
  const nameEn = nullableText(row.name_en);
  return {
    id: requiredUuid(row.id),
    isPublished: requiredBoolean(row.is_published),
    prefectureCode: nullableInteger(row.prefecture_code),
    municipalityCode: nullableMunicipalityCode(row.municipality_code),
    latitude: nullableNumber(row.latitude),
    longitude: nullableNumber(row.longitude),
    websiteUrl: nullableText(row.website_url),
    googleMapsUrl: nullableText(row.google_maps_url),
    instagramUrl: nullableText(row.instagram_url),
    status: nullableStatus(row.status_key),
    translations: {
      ja: {
        name: requiredText(row.name_ja),
        nameReading: nullableText(row.name_reading_ja),
        address: nullableText(row.address_ja),
      },
      en:
        nameEn === null
          ? null
          : {
              name: nameEn,
              nameReading: nullableText(row.name_reading_en),
              address: requiredText(row.address_en),
            },
    },
    tagIds: requiredUuidArray(row.tag_ids),
    updatedAt: requiredDate(row.updated_at),
  };
}

function requiredBoolean(value: unknown) {
  if (typeof value !== "boolean") throw new Error("Invalid boolean returned from database.");
  return value;
}

function requiredText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Invalid text returned from database.");
  return value.trim();
}

function nullableText(value: unknown) {
  return value === null || value === undefined ? null : requiredText(value);
}

function nullableInteger(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed)) throw new Error("Invalid integer returned from database.");
  return parsed;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error("Invalid number returned from database.");
  return parsed;
}

function nullableMunicipalityCode(value: unknown) {
  if (value === null || value === undefined) return null;
  const code = requiredText(value);
  if (!/^\d{6}$/.test(code)) throw new Error("Invalid municipality code returned from database.");
  return code;
}

function nullableStatus(value: unknown): PubStatus | null {
  if (value === null || value === undefined) return null;
  const status = requiredText(value);
  if (!["open", "temporarily_closed", "closed", "unknown"].includes(status)) {
    throw new Error("Invalid pub status returned from database.");
  }
  return status as PubStatus;
}

function requiredUuid(value: unknown) {
  const id = requiredText(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error("Invalid UUID returned from database.");
  }
  return id;
}

function requiredUuidArray(value: unknown) {
  if (!Array.isArray(value)) throw new Error("Invalid UUID array returned from database.");
  return value.map(requiredUuid);
}

function requiredDate(value: unknown) {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.valueOf())) throw new Error("Invalid date returned from database.");
  return date.toISOString();
}
