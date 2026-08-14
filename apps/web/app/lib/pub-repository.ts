import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { asPubs, type Pub } from "@irishpub-map/shared/pub";
import { getValidatedPubs } from "./pub-data";

type PubRow = { data: unknown };
let sqlClient: ReturnType<typeof neon> | null = null;

/** Neonへの接続設定があり、永続化を利用できるかを返します。 */
export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

/** Neon設定時はDB、未設定時は検証済みJSONから店舗一覧を取得します。 */
export async function getPubs() {
  if (!isDatabaseConfigured()) return getValidatedPubs();

  const sql = getSql();
  await ensureTable(sql);
  const rows = (await sql`SELECT data FROM pubs ORDER BY data->>'prefecture', data->>'name'`) as PubRow[];
  return asPubs(rows.map((row) => row.data));
}

/** 外部入力を店舗型として検証し、新しいIDを付けて永続化します。 */
export async function createPub(value: unknown) {
  const pub = toPub(value, randomUUID());
  const sql = getRequiredSql();
  await ensureTable(sql);
  await sql`INSERT INTO pubs (id, data) VALUES (${pub.id}, ${JSON.stringify(pub)}::jsonb)`;
  return pub;
}

/** 外部入力を既存IDの店舗型として検証し、該当レコードを更新します。 */
export async function updatePub(id: string, value: unknown) {
  const pub = toPub(value, id);
  const sql = getRequiredSql();
  await ensureTable(sql);
  const rows =
    (await sql`UPDATE pubs SET data = ${JSON.stringify(pub)}::jsonb, updated_at = NOW() WHERE id = ${id} RETURNING data`) as PubRow[];
  return rows.length === 1 ? asPubs([rows[0].data])[0] : null;
}

/** 指定IDの店舗を削除し、実際に削除できたかを返します。 */
export async function deletePub(id: string) {
  const sql = getRequiredSql();
  await ensureTable(sql);
  const rows = (await sql`DELETE FROM pubs WHERE id = ${id} RETURNING id`) as Array<{ id: string }>;
  return rows.length === 1;
}

function getRequiredSql() {
  if (!isDatabaseConfigured()) throw new Error("Database is not configured.");
  return getSql();
}

function getSql() {
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL!);
  return sqlClient;
}

async function ensureTable(sql: ReturnType<typeof neon>) {
  await sql`CREATE TABLE IF NOT EXISTS pubs (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  const rows = (await sql`SELECT COUNT(*)::int AS count FROM pubs`) as Array<{ count: number }>;
  if (rows[0]?.count === 0) {
    // 空のDBだけを初期化し、既存の管理データをJSONで上書きしないようにします。
    for (const pub of getValidatedPubs()) {
      await sql`INSERT INTO pubs (id, data) VALUES (${pub.id}, ${JSON.stringify(pub)}::jsonb) ON CONFLICT (id) DO NOTHING`;
    }
  }
}

function toPub(value: unknown, id: string): Pub {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid pub data.");
  return asPubs([{ ...(value as Record<string, unknown>), id }])[0];
}
