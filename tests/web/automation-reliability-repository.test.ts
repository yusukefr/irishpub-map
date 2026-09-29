import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseMock = vi.hoisted(() => ({
  queries: [] as { sql: string; values: unknown[] }[],
}));

// 実Repositoryが発行するSQL順と期限条件を検査します。DBの同時実行は検証用Branchでも確認します。
vi.mock("@neondatabase/serverless", () => ({
  neon:
    () =>
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      databaseMock.queries.push({ sql, values });
      if (sql.includes("INSERT INTO automation_idempotency_keys")) {
        return [
          {
            id: "550e8400-e29b-41d4-a716-446655440001",
            request_hash: values[2],
            resource_id: values[6],
            status: "pending",
            status_code: null,
            response_body: null,
          },
        ];
      }
      if (sql.includes("UPDATE automation_idempotency_keys")) return [{ id: values[0] }];
      return [];
    },
}));

import { claimAutomationKey, completeAutomationKey } from "../../apps/web/app/lib/automation-reliability-repository";

const originalDatabaseUrl = process.env.DATABASE_URL;

beforeEach(() => {
  databaseMock.queries.length = 0;
  process.env.DATABASE_URL = "postgres://test-only";
});

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("automation reliability SQL", () => {
  it("deletes only the expired completed target key before the unique claim", async () => {
    const keyHash = "a".repeat(64);
    const result = await claimAutomationKey(
      keyHash,
      "b".repeat(64),
      "POST",
      "/api/automation/v1/content",
      "content",
      "550e8400-e29b-41d4-a716-446655440001",
    );
    expect(result.claimed).toBe(true);
    expect(databaseMock.queries[0].sql).toMatch(/DELETE FROM automation_idempotency_keys/u);
    expect(databaseMock.queries[0].sql).toMatch(/key_hash = \?/u);
    expect(databaseMock.queries[0].sql).toMatch(/status = 'completed' AND expires_at <= now\(\)/u);
    expect(databaseMock.queries[0].values).toEqual([keyHash]);
    expect(databaseMock.queries[1].sql).toMatch(/ON CONFLICT \(key_hash\) DO NOTHING/u);
  });

  it("starts a fresh 24-hour window when pending becomes completed", async () => {
    await completeAutomationKey("550e8400-e29b-41d4-a716-446655440001", 201, { content: { id: "sample" } });
    expect(databaseMock.queries[0].sql).toMatch(/expires_at = now\(\) \+ INTERVAL '24 hours'/u);
    expect(databaseMock.queries[0].sql).toMatch(/WHERE id = \?::uuid AND status = 'pending'/u);
  });
});
