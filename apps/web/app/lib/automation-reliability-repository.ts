import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

/** Automationの変更対象として監査・冪等性に記録するResource種別です。 */
export type AutomationResourceType = "content" | "quiz" | "pub" | "tag";

/** 同一Keyの再送判定と作成済みResourceの回復に使うDB行です。 */
export type IdempotencyRecord = {
  id: string;
  request_hash: string;
  resource_id: string;
  status: "pending" | "completed";
  status_code: number | null;
  response_body: unknown;
};

/** 認証済み変更操作の追跡に必要なmetadataです。 */
export type AuditEntry = {
  requestId: string;
  scope: string;
  method: string;
  path: string;
  resourceType: AutomationResourceType;
  resourceId: string | null;
  action: "create" | "update" | "publish" | "unpublish";
  result: "success" | "failure";
  statusCode: number;
};

let sqlClient: ReturnType<typeof neon> | null = null;

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  return (sqlClient ??= neon(process.env.DATABASE_URL));
}

/**
 * Unique制約でKeyの所有権を確保します。競合時は確定済みまたは処理中の記録を返します。
 * @param keyHash - 生Keyを保存しないためのSHA-256。
 * @param requestHash - Method、Path、canonical JSONのSHA-256。
 * @param method - HTTP Method。
 * @param path - 正規化済みPath。
 * @param resourceType - 作成対象。
 * @param resourceId - この操作に固定するResource ID。
 * @returns 所有権とDB記録。
 */
export async function claimAutomationKey(
  keyHash: string,
  requestHash: string,
  method: string,
  path: string,
  resourceType: AutomationResourceType,
  resourceId: string,
): Promise<{ claimed: boolean; record: IdempotencyRecord }> {
  const sql = getSql();
  const id = randomUUID();
  // 一括cleanupの100件上限に依存せず、今回使うKeyの期限をclaim直前に確定する。
  // 期限切れcompletedだけを削除し、pendingはResource二重作成防止のため残す。
  await sql`
    DELETE FROM automation_idempotency_keys
    WHERE key_hash = ${keyHash} AND status = 'completed' AND expires_at <= now()
  `;
  const inserted = (await sql`
    INSERT INTO automation_idempotency_keys
      (id, key_hash, request_hash, method, path, resource_type, resource_id)
    VALUES (${id}::uuid, ${keyHash}, ${requestHash}, ${method}, ${path}, ${resourceType}, ${resourceId}::uuid)
    ON CONFLICT (key_hash) DO NOTHING
    RETURNING id::text, request_hash, resource_id, status, status_code, response_body
  `) as IdempotencyRecord[];
  if (inserted[0]) return { claimed: true, record: inserted[0] };
  const existing = (await sql`
    SELECT id::text, request_hash, resource_id, status, status_code, response_body
    FROM automation_idempotency_keys WHERE key_hash = ${keyHash}
  `) as IdempotencyRecord[];
  if (!existing[0]) throw new Error("Idempotency claim could not be read.");
  return { claimed: false, record: existing[0] };
}

/**
 * 長時間停止した処理中Keyを同じResource IDのまま回復します。
 * @param id - Idempotency記録ID。
 * @returns 回復権を獲得できた場合はtrue。
 */
export async function takeOverStaleAutomationKey(id: string): Promise<boolean> {
  const rows = (await getSql()`
    UPDATE automation_idempotency_keys SET created_at = now()
    WHERE id = ${id}::uuid AND status = 'pending'
      AND created_at < now() - INTERVAL '30 seconds'
    RETURNING id
  `) as Record<string, unknown>[];
  return rows.length === 1;
}

/**
 * 成功Responseを再送用に保存します。
 * @param id - Idempotency記録ID。
 * @param statusCode - 2xx HTTP status。
 * @param body - 初回のJSON Response。
 * @returns 保存完了時に解決します。
 */
export async function completeAutomationKey(id: string, statusCode: number, body: unknown): Promise<void> {
  const rows = (await getSql()`
    UPDATE automation_idempotency_keys
    SET status = 'completed', status_code = ${statusCode}, response_body = ${JSON.stringify(body)}::jsonb,
      expires_at = now() + INTERVAL '24 hours'
    WHERE id = ${id}::uuid AND status = 'pending'
    RETURNING id
  `) as Record<string, unknown>[];
  if (rows.length !== 1) throw new Error("Idempotency result could not be saved.");
}

/**
 * 作成が発生しなかった場合だけclaimを解放します。
 * @param id - Idempotency記録ID。
 * @returns 削除完了時に解決します。
 */
export async function releaseAutomationKey(id: string): Promise<void> {
  await getSql()`DELETE FROM automation_idempotency_keys WHERE id = ${id}::uuid AND status = 'pending'`;
}

/**
 * 完了済みで24時間を過ぎた記録を少量ずつ削除します。処理中記録は事故時の二重作成防止のため残します。
 * @returns 今回削除した件数。
 */
export async function cleanupExpiredAutomationKeys(): Promise<number> {
  const rows = (await getSql()`
    WITH expired AS (
      SELECT id FROM automation_idempotency_keys
      WHERE status = 'completed' AND expires_at <= now()
      ORDER BY expires_at LIMIT 100
    )
    DELETE FROM automation_idempotency_keys AS entry USING expired
    WHERE entry.id = expired.id RETURNING entry.id
  `) as Record<string, unknown>[];
  return rows.length;
}

/**
 * 認証済み変更操作のmetadataだけを監査記録へ追加します。
 * @param entry - 本文と認証情報を含まない監査項目。
 * @returns 記録完了時に解決します。
 */
export async function insertAutomationAudit(entry: AuditEntry): Promise<void> {
  const id = randomUUID();
  await getSql()`
    INSERT INTO automation_audit_logs
      (id, request_id, scope, method, path, resource_type, resource_id, action, result, status_code)
    VALUES (${id}::uuid, ${entry.requestId}::uuid, ${entry.scope}, ${entry.method}, ${entry.path},
      ${entry.resourceType}, ${entry.resourceId}::uuid, ${entry.action}, ${entry.result}, ${entry.statusCode})
  `;
}
