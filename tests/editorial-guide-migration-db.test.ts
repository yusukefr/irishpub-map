// @vitest-environment node
import { Client } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadGuides, migrateGuides } from "../scripts/migrate-editorial-guides.mjs";

// 明示した非Production接続先でのみ実行。TEMP TABLEは接続終了時に消え、実Contentを変更しません。
describe.skipIf(!process.env.MIGRATION_TEST_DATABASE_URL)("Guide migration transaction on Neon", () => {
  const client = new Client({
    connectionString: process.env.MIGRATION_TEST_DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });
  let guides: Awaited<ReturnType<typeof loadGuides>>;
  beforeAll(async () => {
    await client.connect();
    await client.query("CREATE TEMP TABLE content_entries (LIKE public.content_entries INCLUDING ALL)");
    await client.query("CREATE TEMP TABLE content_translations (LIKE public.content_translations INCLUDING ALL)");
    await client.query(
      "ALTER TABLE pg_temp.content_translations ADD FOREIGN KEY (content_id) REFERENCES pg_temp.content_entries(id)",
    );
    guides = await loadGuides();
  }, 30000);
  afterAll(async () => {
    await client.end();
  });

  it("dry-run、投入、verify、再実行で件数・ID・日時を維持する", async () => {
    expect((await migrateGuides(client, guides, "dry-run")).map((v) => v.result)).toEqual(["WOULD_ADD", "WOULD_ADD"]);
    expect((await client.query("SELECT * FROM pg_temp.content_entries")).rows).toHaveLength(0);
    expect((await migrateGuides(client, guides, "apply")).map((v) => v.result)).toEqual(["ADDED", "ADDED"]);
    const entries = (await client.query("SELECT * FROM pg_temp.content_entries ORDER BY slug")).rows;
    const translations = (await client.query("SELECT * FROM pg_temp.content_translations ORDER BY content_id, locale"))
      .rows;
    expect(entries).toHaveLength(2);
    expect(translations).toHaveLength(4);
    expect((await migrateGuides(client, guides, "verify")).map((v) => v.result)).toEqual(["SKIP", "SKIP"]);
    await migrateGuides(client, guides, "apply");
    expect((await client.query("SELECT * FROM pg_temp.content_entries ORDER BY slug")).rows).toEqual(entries);
    expect((await client.query("SELECT * FROM pg_temp.content_translations ORDER BY content_id, locale")).rows).toEqual(
      translations,
    );
  }, 30000);

  it("既存値が異なると上書きせず拒否する", async () => {
    const modified = structuredClone(guides);
    modified[0].translations.en.title = "Different";
    await expect(migrateGuides(client, modified, "apply")).rejects.toThrow("上書きしません");
    await migrateGuides(client, guides, "verify");
  }, 30000);

  it("英語INSERT失敗時に親と日本語INSERTもrollbackする", async () => {
    // 新しい接続内だけのテスト表を空にし、英語INSERTをDB CHECK制約で拒否します。
    await client.query("TRUNCATE pg_temp.content_translations, pg_temp.content_entries");
    await client.query("ALTER TABLE pg_temp.content_translations ADD CHECK (locale <> 'en')");
    await expect(migrateGuides(client, guides, "apply")).rejects.toThrow();
    expect((await client.query("SELECT * FROM pg_temp.content_entries")).rows).toHaveLength(0);
    expect((await client.query("SELECT * FROM pg_temp.content_translations")).rows).toHaveLength(0);
  }, 30000);
});
