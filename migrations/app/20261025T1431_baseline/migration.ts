#!/usr/bin/env -S node
import type { Contract as End } from "../../snapshots/4ee73e5187a8748d34b95605ee84c9f202368e31f37bf9c3a334261fce037371/contract";
import endContract from "../../snapshots/4ee73e5187a8748d34b95605ee84c9f202368e31f37bf9c3a334261fce037371/contract.json" with { type: "json" };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  rawSql,
} from "@prisma/orm-postgres/migration";

const createDescendingIndex = ({
  table,
  name,
  columns,
  expectedDefinition,
}: {
  table: string;
  name: string;
  columns: string;
  expectedDefinition: string;
}) =>
  rawSql({
    id: `index.${table}.${name}`,
    label: `Create index \"${name}\" on \"${table}\"`,
    operationClass: "additive",
    target: {
      id: "postgres",
      details: { schema: "public", objectType: "index", name, table },
    },
    precheck: [
      {
        description: `ensure index \"${name}\" does not exist`,
        sql: 'SELECT (to_regclass($1)) IS NULL AS \"result\"',
        params: [`\"public\".\"${name}\"`],
      },
    ],
    execute: [
      {
        description: `create index \"${name}\"`,
        sql: `CREATE INDEX \"${name}\" ON \"public\".\"${table}\" (${columns})`,
        params: [],
      },
    ],
    postcheck: [
      {
        description: `verify index \"${name}\" has its expected definition`,
        sql: 'SELECT COALESCE((SELECT pg_get_indexdef(to_regclass($1)::oid) = $2), FALSE) AS \"result\"',
        params: [`\"public\".\"${name}\"`, expectedDefinition],
      },
    ],
  });

const createDeferredCorrectChoiceForeignKey = () =>
  rawSql({
    id: "foreignKey.quiz_questions.quiz_questions_correct_choice_fkey",
    label: 'Add deferred foreign key \"quiz_questions_correct_choice_fkey\" on \"quiz_questions\"',
    operationClass: "additive",
    target: {
      id: "postgres",
      details: {
        schema: "public",
        objectType: "foreignKey",
        name: "quiz_questions_correct_choice_fkey",
        table: "quiz_questions",
      },
    },
    precheck: [
      {
        description: 'ensure FK \"quiz_questions_correct_choice_fkey\" does not exist',
        sql: 'SELECT NOT EXISTS (SELECT 1 AS \"one\" FROM \"pg_constraint\" AS \"c\" INNER JOIN \"pg_namespace\" AS \"n\" ON \"n\".\"oid\" = \"c\".\"connamespace\" WHERE (\"c\".\"conname\" = $1 AND \"n\".\"nspname\" = $2 AND \"c\".\"conrelid\" = to_regclass($3))) AS \"result\"',
        params: ["quiz_questions_correct_choice_fkey", "public", '\"public\".\"quiz_questions\"'],
      },
    ],
    execute: [
      {
        description: 'add deferred FK \"quiz_questions_correct_choice_fkey\"',
        sql: 'ALTER TABLE \"public\".\"quiz_questions\"\nADD CONSTRAINT \"quiz_questions_correct_choice_fkey\"\nFOREIGN KEY (\"id\", \"correct_choice_id\")\nREFERENCES \"public\".\"quiz_choices\" (\"question_id\", \"id\")\nDEFERRABLE INITIALLY DEFERRED',
      },
    ],
    postcheck: [
      {
        description: 'verify FK \"quiz_questions_correct_choice_fkey\" is initially deferred',
        sql: 'SELECT EXISTS (SELECT 1 AS \"one\" FROM \"pg_constraint\" AS \"c\" INNER JOIN \"pg_namespace\" AS \"n\" ON \"n\".\"oid\" = \"c\".\"connamespace\" WHERE (\"c\".\"conname\" = $1 AND \"n\".\"nspname\" = $2 AND \"c\".\"conrelid\" = to_regclass($3) AND \"c\".\"condeferrable\" AND \"c\".\"condeferred\")) AS \"result\"',
        params: ["quiz_questions_correct_choice_fkey", "public", '\"public\".\"quiz_questions\"'],
      },
    ],
  });

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: "public" }),
      this.createTable({
        schema: "public",
        table: "automation_audit_logs",
        columns: [
          col("action", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("created_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("method", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("path", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("request_id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("resource_id", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("resource_type", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("result", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("scope", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("status_code", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
        ],
        constraints: [
          primaryKey(["id"], { name: "automation_audit_logs_pkey" }),
          checkExpression(
            "automation_audit_logs_action_check",
            "(action = ANY (ARRAY['create'::text, 'update'::text, 'publish'::text, 'unpublish'::text]))",
          ),
          checkExpression(
            "automation_audit_logs_resource_type_check",
            "(resource_type = ANY (ARRAY['content'::text, 'quiz'::text, 'pub'::text, 'tag'::text]))",
          ),
          checkExpression(
            "automation_audit_logs_result_check",
            "(result = ANY (ARRAY['success'::text, 'failure'::text]))",
          ),
          checkExpression("automation_audit_logs_status_code_check", "((status_code >= 100) AND (status_code <= 599))"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "automation_idempotency_keys",
        columns: [
          col("created_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("expires_at", "timestamptz", {
            notNull: true,
            default: fn("(now() + '24:00:00'::interval)"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("key_hash", "character(64)", {
            notNull: true,
            codecRef: { codecId: "sql/char@1", typeParams: { length: 64 } },
          }),
          col("method", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("path", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("request_hash", "character(64)", {
            notNull: true,
            codecRef: { codecId: "sql/char@1", typeParams: { length: 64 } },
          }),
          col("resource_id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("resource_type", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("response_body", "jsonb", { codecRef: { codecId: "pg/jsonb@1" } }),
          col("status", "text", {
            notNull: true,
            default: lit("pending"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("status_code", "int4", { codecRef: { codecId: "pg/int4@1" } }),
        ],
        constraints: [
          primaryKey(["id"], { name: "automation_idempotency_keys_pkey" }),
          checkExpression(
            "automation_idempotency_keys_resource_type_check",
            "(resource_type = ANY (ARRAY['content'::text, 'quiz'::text, 'pub'::text, 'tag'::text]))",
          ),
          checkExpression(
            "automation_idempotency_keys_status_check",
            "(status = ANY (ARRAY['pending'::text, 'completed'::text]))",
          ),
          checkExpression(
            "automation_idempotency_response_check",
            "(((status = 'pending'::text) AND (status_code IS NULL) AND (response_body IS NULL)) OR ((status = 'completed'::text) AND ((status_code >= 200) AND (status_code <= 299)) AND (response_body IS NOT NULL)))",
          ),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "calendar_event_translations",
        columns: [
          col("description", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("event_id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("locale", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("name", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("updated_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
        ],
        constraints: [
          primaryKey(["event_id", "locale"], { name: "calendar_event_translations_pkey" }),
          checkExpression("calendar_event_translations_locale_check", "(locale = ANY (ARRAY['ja'::text, 'en'::text]))"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "calendar_events",
        columns: [
          col("aliases", "text[]", {
            notNull: true,
            default: lit([]),
            codecRef: { codecId: "pg/text@1", many: true },
          }),
          col("category", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("created_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("date_rule", "jsonb", { codecRef: { codecId: "pg/jsonb@1" } }),
          col("featured", "bool", {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: "pg/bool@1" },
          }),
          col("id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("is_public_holiday", "bool", {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: "pg/bool@1" },
          }),
          col("is_published", "bool", {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: "pg/bool@1" },
          }),
          col("sort_order", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
          col("source", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("updated_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
        ],
        constraints: [
          primaryKey(["id"], { name: "calendar_events_pkey" }),
          checkExpression(
            "calendar_events_category_check",
            "((category IS NULL) OR (category = ANY (ARRAY['public_holiday'::text, 'culture'::text, 'tradition'::text, 'language'::text, 'literature'::text, 'history'::text, 'religion'::text])))",
          ),
          checkExpression(
            "calendar_events_date_rule_check",
            "((date_rule IS NULL) OR ((jsonb_typeof(date_rule) = 'object'::text) AND (date_rule ? 'type'::text) AND (jsonb_typeof((date_rule -> 'type'::text)) = 'string'::text) AND ((date_rule ->> 'type'::text) = ANY (ARRAY['fixed'::text, 'date_range'::text, 'nth_weekday'::text, 'last_weekday'::text, 'relative_to_easter'::text, 'weekday_on_or_after'::text, 'closest_weekday_to_date'::text, 'rule_set'::text, 'annual_variable'::text]))))",
          ),
          checkExpression("calendar_events_sort_order_check", "(sort_order >= 0)"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "content_entries",
        columns: [
          col("category", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("created_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("hero_image_asset_id", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("kind", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("published_at", "timestamptz", {
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("slug", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("status", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("updated_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
        ],
        constraints: [
          primaryKey(["id"], { name: "content_entries_pkey" }),
          checkExpression("content_entries_category_check", "(btrim(category) <> ''::text)"),
          checkExpression("content_entries_kind_check", "(btrim(kind) <> ''::text)"),
          checkExpression(
            "content_entries_publication_state_check",
            "(((status = 'draft'::text) AND (published_at IS NULL)) OR ((status = 'published'::text) AND (published_at IS NOT NULL)))",
          ),
          checkExpression("content_entries_slug_check", "(btrim(slug) <> ''::text)"),
          checkExpression("content_entries_status_check", "(status = ANY (ARRAY['draft'::text, 'published'::text]))"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "content_translations",
        columns: [
          col("body_markdown", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("content_id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("hero_image_alt", "text", {
            notNull: true,
            default: fn("''::text"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("hero_image_caption", "text", {
            notNull: true,
            default: fn("''::text"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("locale", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("summary", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("title", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("updated_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
        ],
        constraints: [
          primaryKey(["content_id", "locale"], { name: "content_translations_pkey" }),
          checkExpression("content_translations_hero_image_alt_length_check", "(char_length(hero_image_alt) <= 500)"),
          checkExpression(
            "content_translations_hero_image_caption_length_check",
            "(char_length(hero_image_caption) <= 1000)",
          ),
          checkExpression("content_translations_locale_check", "(locale = ANY (ARRAY['ja'::text, 'en'::text]))"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "media_assets",
        columns: [
          col("created_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("file_size", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
          col("height", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
          col("id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("mime_type", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("storage_key", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("url", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("width", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
        ],
        constraints: [
          primaryKey(["id"], { name: "media_assets_pkey" }),
          checkExpression("media_assets_file_size_check", "((file_size >= 1) AND (file_size <= 4194304))"),
          checkExpression("media_assets_height_check", "((height >= 1) AND (height <= 8192))"),
          checkExpression(
            "media_assets_mime_type_check",
            "(mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text]))",
          ),
          checkExpression("media_assets_pixel_count_check", "(((width)::bigint * (height)::bigint) <= 40000000)"),
          checkExpression(
            "media_assets_storage_key_check",
            "((btrim(storage_key) <> ''::text) AND (storage_key = btrim(storage_key)))",
          ),
          checkExpression("media_assets_url_check", "((btrim(url) <> ''::text) AND (url = btrim(url)))"),
          checkExpression("media_assets_width_check", "((width >= 1) AND (width <= 8192))"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "municipality_codes",
        columns: [
          col("code", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("prefecture_code", "int2", { notNull: true, codecRef: { codecId: "pg/int2@1" } }),
        ],
        constraints: [
          primaryKey(["code"], { name: "municipality_codes_pkey" }),
          checkExpression("municipality_codes_code_check", "(code ~ '^[0-9]{6}$'::text)"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "municipality_translations",
        columns: [
          col("locale", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("municipality_code", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("name", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("name_reading", "text", { codecRef: { codecId: "pg/text@1" } }),
        ],
        constraints: [
          primaryKey(["municipality_code", "locale"], { name: "municipality_translations_pkey" }),
          checkExpression("municipality_translations_locale_check", "(locale = ANY (ARRAY['ja'::text, 'en'::text]))"),
          checkExpression("municipality_translations_name_check", "(btrim(name) <> ''::text)"),
          checkExpression(
            "municipality_translations_name_reading_check",
            "((name_reading IS NULL) OR (btrim(name_reading) <> ''::text))",
          ),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "prefecture_translations",
        columns: [
          col("locale", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("name", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("name_reading", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("prefecture_code", "int2", { notNull: true, codecRef: { codecId: "pg/int2@1" } }),
        ],
        constraints: [
          primaryKey(["prefecture_code", "locale"], { name: "prefecture_translations_pkey" }),
          checkExpression("prefecture_translations_locale_check", "(locale = ANY (ARRAY['ja'::text, 'en'::text]))"),
          checkExpression("prefecture_translations_name_check", "(btrim(name) <> ''::text)"),
          checkExpression(
            "prefecture_translations_name_reading_check",
            "((name_reading IS NULL) OR (btrim(name_reading) <> ''::text))",
          ),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "prefectures",
        columns: [col("code", "int2", { notNull: true, codecRef: { codecId: "pg/int2@1" } })],
        constraints: [
          primaryKey(["code"], { name: "prefectures_pkey" }),
          checkExpression("prefectures_code_check", "((code >= 1) AND (code <= 47))"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "pub_status_translations",
        columns: [
          col("display_name", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("locale", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("status_code", "int2", { notNull: true, codecRef: { codecId: "pg/int2@1" } }),
        ],
        constraints: [
          primaryKey(["status_code", "locale"], { name: "pub_status_translations_pkey" }),
          checkExpression("pub_status_translations_display_name_check", "(btrim(display_name) <> ''::text)"),
          checkExpression("pub_status_translations_locale_check", "(locale = ANY (ARRAY['ja'::text, 'en'::text]))"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "pub_statuses",
        columns: [
          col("code", "int2", { notNull: true, codecRef: { codecId: "pg/int2@1" } }),
          col("key", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
        ],
        constraints: [primaryKey(["code"], { name: "pub_statuses_pkey" })],
      }),
      this.createTable({
        schema: "public",
        table: "pub_tags",
        columns: [
          col("pub_id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("tag_id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
        ],
        constraints: [primaryKey(["pub_id", "tag_id"], { name: "pub_tags_pkey" })],
      }),
      this.createTable({
        schema: "public",
        table: "pub_translations",
        columns: [
          col("address", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("locale", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("name", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("name_reading", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("pub_id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("updated_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
        ],
        constraints: [
          primaryKey(["pub_id", "locale"], { name: "pub_translations_pkey" }),
          checkExpression("pub_translations_address_check", "((address IS NULL) OR (btrim(address) <> ''::text))"),
          checkExpression("pub_translations_locale_check", "(locale = ANY (ARRAY['ja'::text, 'en'::text]))"),
          checkExpression("pub_translations_name_check", "(btrim(name) <> ''::text)"),
          checkExpression(
            "pub_translations_name_reading_check",
            "((name_reading IS NULL) OR (btrim(name_reading) <> ''::text))",
          ),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "pub_type_translations",
        columns: [
          col("display_name", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("locale", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("pub_type_code", "int2", { notNull: true, codecRef: { codecId: "pg/int2@1" } }),
        ],
        constraints: [
          primaryKey(["pub_type_code", "locale"], { name: "pub_type_translations_pkey" }),
          checkExpression("pub_type_translations_display_name_check", "(btrim(display_name) <> ''::text)"),
          checkExpression("pub_type_translations_locale_check", "(locale = ANY (ARRAY['ja'::text, 'en'::text]))"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "pub_types",
        columns: [
          col("code", "int2", { notNull: true, codecRef: { codecId: "pg/int2@1" } }),
          col("key", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
        ],
        constraints: [
          primaryKey(["code"], { name: "pub_types_pkey" }),
          checkExpression(
            "pub_types_key_check",
            "(key = ANY (ARRAY['irish'::text, 'british'::text, 'other'::text, 'unclassified'::text]))",
          ),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "pubs",
        columns: [
          col("google_maps_url", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("instagram_url", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("is_published", "bool", {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: "pg/bool@1" },
          }),
          col("latitude", "float8", { codecRef: { codecId: "pg/float8@1" } }),
          col("longitude", "float8", { codecRef: { codecId: "pg/float8@1" } }),
          col("municipality_code", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("prefecture_code", "int2", { codecRef: { codecId: "pg/int2@1" } }),
          col("pub_type_code", "int2", { codecRef: { codecId: "pg/int2@1" } }),
          col("status_code", "int2", { codecRef: { codecId: "pg/int2@1" } }),
          col("updated_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("website_url", "text", { codecRef: { codecId: "pg/text@1" } }),
        ],
        constraints: [
          primaryKey(["id"], { name: "pubs_columns_new_pkey" }),
          checkExpression(
            "pubs_columns_new_google_maps_url_check",
            "((google_maps_url IS NULL) OR (google_maps_url ~* '^https?://'::text))",
          ),
          checkExpression(
            "pubs_columns_new_instagram_url_check",
            "((instagram_url IS NULL) OR (instagram_url ~* '^https?://'::text))",
          ),
          checkExpression(
            "pubs_columns_new_latitude_check",
            "((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))",
          ),
          checkExpression(
            "pubs_columns_new_longitude_check",
            "((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision))",
          ),
          checkExpression(
            "pubs_columns_new_website_url_check",
            "((website_url IS NULL) OR (website_url ~* '^https?://'::text))",
          ),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "quiz_choice_translations",
        columns: [
          col("choice_id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("label", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("locale", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("question_id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("updated_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
        ],
        constraints: [
          primaryKey(["question_id", "choice_id", "locale"], {
            name: "quiz_choice_translations_pkey",
          }),
          checkExpression("quiz_choice_translations_locale_check", "(locale = ANY (ARRAY['ja'::text, 'en'::text]))"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "quiz_choices",
        columns: [
          col("created_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("id", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("question_id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("sort_order", "int4", { notNull: true, codecRef: { codecId: "pg/int4@1" } }),
          col("updated_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
        ],
        constraints: [
          primaryKey(["question_id", "id"], { name: "quiz_choices_pkey" }),
          checkExpression("quiz_choices_id_check", "(btrim(id) <> ''::text)"),
          checkExpression("quiz_choices_sort_order_check", "(sort_order >= 0)"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "quiz_question_translations",
        columns: [
          col("explanation", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("image_alt", "text", {
            notNull: true,
            default: fn("''::text"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("image_caption", "text", {
            notNull: true,
            default: fn("''::text"),
            codecRef: { codecId: "pg/text@1" },
          }),
          col("locale", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("question", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("question_id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("source_label", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("updated_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
        ],
        constraints: [
          primaryKey(["question_id", "locale"], { name: "quiz_question_translations_pkey" }),
          checkExpression("quiz_question_translations_image_alt_length_check", "(char_length(image_alt) <= 500)"),
          checkExpression(
            "quiz_question_translations_image_caption_length_check",
            "(char_length(image_caption) <= 1000)",
          ),
          checkExpression("quiz_question_translations_locale_check", "(locale = ANY (ARRAY['ja'::text, 'en'::text]))"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "quiz_questions",
        columns: [
          col("category", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("correct_choice_id", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("created_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
          col("id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("image_asset_id", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("is_published", "bool", {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: "pg/bool@1" },
          }),
          col("related_content_id", "uuid", { codecRef: { codecId: "pg/uuid@1" } }),
          col("source_url", "text", { codecRef: { codecId: "pg/text@1" } }),
          col("special_day", "int2", { codecRef: { codecId: "pg/int2@1" } }),
          col("special_month", "int2", { codecRef: { codecId: "pg/int2@1" } }),
          col("updated_at", "timestamptz", {
            notNull: true,
            default: fn("now()"),
            codecRef: { codecId: "pg/timestamptz-temporal@1" },
          }),
        ],
        constraints: [
          primaryKey(["id"], { name: "quiz_questions_pkey" }),
          checkExpression("quiz_questions_category_check", "((category IS NULL) OR (btrim(category) <> ''::text))"),
          checkExpression(
            "quiz_questions_correct_choice_id_check",
            "((correct_choice_id IS NULL) OR (btrim(correct_choice_id) <> ''::text))",
          ),
          checkExpression(
            "quiz_questions_source_url_check",
            "((source_url IS NULL) OR (btrim(source_url) <> ''::text))",
          ),
          checkExpression(
            "quiz_questions_special_date_check",
            "(((special_month IS NULL) = (special_day IS NULL)) AND ((special_month IS NULL) OR ((special_month >= 1) AND (special_month <= 12) AND ((special_day >= 1) AND (special_day <=\nCASE\n    WHEN (special_month = 2) THEN 29\n    WHEN (special_month = ANY (ARRAY[4, 6, 9, 11])) THEN 30\n    ELSE 31\nEND)))))",
          ),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "tag_translations",
        columns: [
          col("locale", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("name", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
          col("tag_id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
        ],
        constraints: [
          primaryKey(["tag_id", "locale"], { name: "tag_translations_pkey" }),
          checkExpression("tag_translations_locale_check", "(locale = ANY (ARRAY['ja'::text, 'en'::text]))"),
          checkExpression("tag_translations_name_check", "(btrim(name) <> ''::text)"),
        ],
      }),
      this.createTable({
        schema: "public",
        table: "tags",
        columns: [
          col("id", "uuid", { notNull: true, codecRef: { codecId: "pg/uuid@1" } }),
          col("key", "text", { notNull: true, codecRef: { codecId: "pg/text@1" } }),
        ],
        constraints: [primaryKey(["id"], { name: "tags_pkey" })],
      }),
      this.addUnique({
        schema: "public",
        table: "automation_idempotency_keys",
        constraint: "automation_idempotency_keys_key_hash_key",
        columns: ["key_hash"],
      }),
      this.addUnique({
        schema: "public",
        table: "content_entries",
        constraint: "content_entries_kind_slug_key",
        columns: ["kind", "slug"],
      }),
      this.addUnique({
        schema: "public",
        table: "media_assets",
        constraint: "media_assets_storage_key_key",
        columns: ["storage_key"],
      }),
      this.addUnique({
        schema: "public",
        table: "media_assets",
        constraint: "media_assets_url_key",
        columns: ["url"],
      }),
      this.addUnique({
        schema: "public",
        table: "prefecture_translations",
        constraint: "prefecture_translations_locale_name_key",
        columns: ["locale", "name"],
      }),
      this.addUnique({
        schema: "public",
        table: "pub_statuses",
        constraint: "pub_statuses_key_unique",
        columns: ["key"],
      }),
      this.addUnique({
        schema: "public",
        table: "pub_types",
        constraint: "pub_types_key_key",
        columns: ["key"],
      }),
      this.addUnique({
        schema: "public",
        table: "quiz_choices",
        constraint: "quiz_choices_question_sort_order_key",
        columns: ["question_id", "sort_order"],
      }),
      this.addUnique({
        schema: "public",
        table: "tag_translations",
        constraint: "tag_translations_locale_name_key",
        columns: ["locale", "name"],
      }),
      this.addUnique({
        schema: "public",
        table: "tags",
        constraint: "tags_key_unique",
        columns: ["key"],
      }),
      createDescendingIndex({
        table: "automation_audit_logs",
        name: "automation_audit_logs_created_at_idx",
        columns: '\"created_at\" DESC',
        expectedDefinition:
          "CREATE INDEX automation_audit_logs_created_at_idx ON public.automation_audit_logs USING btree (created_at DESC)",
      }),
      this.createIndex({
        schema: "public",
        table: "automation_audit_logs",
        index: "automation_audit_logs_request_id_idx",
        columns: ["request_id"],
      }),
      this.createIndex({
        schema: "public",
        table: "automation_audit_logs",
        index: "automation_audit_logs_resource_idx",
        columns: ["resource_type", "resource_id"],
      }),
      this.createIndex({
        schema: "public",
        table: "automation_idempotency_keys",
        index: "automation_idempotency_keys_expires_at_idx",
        columns: ["expires_at"],
        extras: { where: "(status = 'completed'::text)" },
      }),
      createDescendingIndex({
        table: "calendar_events",
        name: "calendar_events_admin_list_idx",
        columns: '\"updated_at\" DESC, \"id\" ASC',
        expectedDefinition:
          "CREATE INDEX calendar_events_admin_list_idx ON public.calendar_events USING btree (updated_at DESC, id)",
      }),
      this.createIndex({
        schema: "public",
        table: "calendar_events",
        index: "calendar_events_category_idx",
        columns: ["category", "sort_order", "id"],
      }),
      this.createIndex({
        schema: "public",
        table: "calendar_events",
        index: "calendar_events_published_idx",
        columns: ["sort_order", "id"],
        extras: { where: "is_published" },
      }),
      this.createIndex({
        schema: "public",
        table: "calendar_events",
        index: "calendar_events_sort_order_idx",
        columns: ["sort_order", "id"],
      }),
      this.createIndex({
        schema: "public",
        table: "content_entries",
        index: "content_entries_hero_image_asset_id_idx",
        columns: ["hero_image_asset_id"],
        extras: { where: "(hero_image_asset_id IS NOT NULL)" },
      }),
      createDescendingIndex({
        table: "media_assets",
        name: "media_assets_admin_list_idx",
        columns: '\"created_at\" DESC, \"id\" DESC',
        expectedDefinition:
          "CREATE INDEX media_assets_admin_list_idx ON public.media_assets USING btree (created_at DESC, id DESC)",
      }),
      this.createIndex({
        schema: "public",
        table: "pub_tags",
        index: "pub_tags_tag_id_idx",
        columns: ["tag_id"],
      }),
      this.createIndex({
        schema: "public",
        table: "pubs",
        index: "pubs_municipality_code_idx",
        columns: ["municipality_code"],
      }),
      this.createIndex({
        schema: "public",
        table: "pubs",
        index: "pubs_prefecture_code_idx",
        columns: ["prefecture_code"],
      }),
      this.createIndex({
        schema: "public",
        table: "pubs",
        index: "pubs_pub_type_code_idx",
        columns: ["pub_type_code"],
      }),
      this.createIndex({
        schema: "public",
        table: "pubs",
        index: "pubs_status_code_idx",
        columns: ["status_code"],
      }),
      createDescendingIndex({
        table: "quiz_questions",
        name: "quiz_questions_admin_list_idx",
        columns: '\"updated_at\" DESC, \"id\" ASC',
        expectedDefinition:
          "CREATE INDEX quiz_questions_admin_list_idx ON public.quiz_questions USING btree (updated_at DESC, id)",
      }),
      this.createIndex({
        schema: "public",
        table: "quiz_questions",
        index: "quiz_questions_category_idx",
        columns: ["category", "id"],
      }),
      this.createIndex({
        schema: "public",
        table: "quiz_questions",
        index: "quiz_questions_image_asset_id_idx",
        columns: ["image_asset_id"],
        extras: { where: "(image_asset_id IS NOT NULL)" },
      }),
      this.createIndex({
        schema: "public",
        table: "quiz_questions",
        index: "quiz_questions_published_idx",
        columns: ["id"],
        extras: { where: "is_published" },
      }),
      this.createIndex({
        schema: "public",
        table: "quiz_questions",
        index: "quiz_questions_related_content_id_idx",
        columns: ["related_content_id"],
        extras: { where: "(related_content_id IS NOT NULL)" },
      }),
      this.createIndex({
        schema: "public",
        table: "quiz_questions",
        index: "quiz_questions_special_date_idx",
        columns: ["special_month", "special_day", "id"],
        extras: { where: "(is_published AND (special_month IS NOT NULL))" },
      }),
      this.addForeignKey({
        schema: "public",
        table: "calendar_event_translations",
        foreignKey: {
          name: "calendar_event_translations_event_id_fkey",
          columns: ["event_id"],
          references: { schema: "public", table: "calendar_events", columns: ["id"] },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "content_entries",
        foreignKey: {
          name: "content_entries_hero_image_asset_id_fkey",
          columns: ["hero_image_asset_id"],
          references: { schema: "public", table: "media_assets", columns: ["id"] },
          onDelete: "setNull",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "content_translations",
        foreignKey: {
          name: "content_translations_content_id_fkey",
          columns: ["content_id"],
          references: { schema: "public", table: "content_entries", columns: ["id"] },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "municipality_codes",
        foreignKey: {
          name: "municipality_codes_prefecture_code_fkey",
          columns: ["prefecture_code"],
          references: { schema: "public", table: "prefectures", columns: ["code"] },
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "municipality_translations",
        foreignKey: {
          name: "municipality_translations_municipality_code_fkey",
          columns: ["municipality_code"],
          references: { schema: "public", table: "municipality_codes", columns: ["code"] },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "prefecture_translations",
        foreignKey: {
          name: "prefecture_translations_prefecture_code_fkey",
          columns: ["prefecture_code"],
          references: { schema: "public", table: "prefectures", columns: ["code"] },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "pub_status_translations",
        foreignKey: {
          name: "pub_status_translations_status_code_fkey",
          columns: ["status_code"],
          references: { schema: "public", table: "pub_statuses", columns: ["code"] },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "pub_tags",
        foreignKey: {
          name: "pub_tags_pub_id_fkey1",
          columns: ["pub_id"],
          references: { schema: "public", table: "pubs", columns: ["id"] },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "pub_tags",
        foreignKey: {
          name: "pub_tags_tag_id_fkey",
          columns: ["tag_id"],
          references: { schema: "public", table: "tags", columns: ["id"] },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "pub_translations",
        foreignKey: {
          name: "pub_translations_pub_id_fkey",
          columns: ["pub_id"],
          references: { schema: "public", table: "pubs", columns: ["id"] },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "pub_type_translations",
        foreignKey: {
          name: "pub_type_translations_pub_type_code_fkey",
          columns: ["pub_type_code"],
          references: { schema: "public", table: "pub_types", columns: ["code"] },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "pubs",
        foreignKey: {
          name: "pubs_prefecture_code_fkey",
          columns: ["prefecture_code"],
          references: { schema: "public", table: "prefectures", columns: ["code"] },
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "pubs",
        foreignKey: {
          name: "pubs_status_code_fkey",
          columns: ["status_code"],
          references: { schema: "public", table: "pub_statuses", columns: ["code"] },
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "pubs",
        foreignKey: {
          name: "pubs_municipality_code_fkey",
          columns: ["municipality_code"],
          references: { schema: "public", table: "municipality_codes", columns: ["code"] },
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "pubs",
        foreignKey: {
          name: "pubs_pub_type_code_fkey",
          columns: ["pub_type_code"],
          references: { schema: "public", table: "pub_types", columns: ["code"] },
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "quiz_choice_translations",
        foreignKey: {
          name: "quiz_choice_translations_choice_fkey",
          columns: ["question_id", "choice_id"],
          references: { schema: "public", table: "quiz_choices", columns: ["question_id", "id"] },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "quiz_choices",
        foreignKey: {
          name: "quiz_choices_question_id_fkey",
          columns: ["question_id"],
          references: { schema: "public", table: "quiz_questions", columns: ["id"] },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "quiz_question_translations",
        foreignKey: {
          name: "quiz_question_translations_question_id_fkey",
          columns: ["question_id"],
          references: { schema: "public", table: "quiz_questions", columns: ["id"] },
          onDelete: "cascade",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "quiz_questions",
        foreignKey: {
          name: "quiz_questions_related_content_id_fkey",
          columns: ["related_content_id"],
          references: { schema: "public", table: "content_entries", columns: ["id"] },
          onDelete: "setNull",
        },
      }),
      this.addForeignKey({
        schema: "public",
        table: "quiz_questions",
        foreignKey: {
          name: "quiz_questions_image_asset_id_fkey",
          columns: ["image_asset_id"],
          references: { schema: "public", table: "media_assets", columns: ["id"] },
          onDelete: "setNull",
        },
      }),
      createDeferredCorrectChoiceForeignKey(),
      this.addForeignKey({
        schema: "public",
        table: "tag_translations",
        foreignKey: {
          name: "tag_translations_tag_id_fkey",
          columns: ["tag_id"],
          references: { schema: "public", table: "tags", columns: ["id"] },
          onDelete: "cascade",
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
