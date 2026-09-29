// Automationで作成したタグを、実Repositoryを通じてMaster一覧から再取得できることを保証します。
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Tag Repositoryとの結合を検証する。冪等性と監査は専用テストで検証します。
vi.mock("../../apps/web/app/lib/automation-reliability", () => ({
  handleAutomationCreate: (_request: Request, options: { execute: (id: string) => Promise<Response> }) =>
    options.execute("550e8400-e29b-41d4-a716-446655440001"),
}));

const databaseMock = vi.hoisted(() => ({
  tag: null as null | { id: string; key: string; translations: Record<string, string> },
}));

// SQL境界だけを置き換え、2つのRouteとタグRepositoryは実装を使用します。
vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const query = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes("SELECT tag.id::text, tag.key")) {
        const tag = databaseMock.tag;
        return Promise.resolve(tag ? [{ ...tag, pub_count: 0 }] : []);
      }
      if (sql.includes("INSERT INTO tags")) {
        databaseMock.tag = { id: String(values[0]), key: String(values[1]), translations: {} };
      }
      if (sql.includes("INSERT INTO tag_translations")) {
        databaseMock.tag!.translations[String(values[1])] = String(values[2]);
      }
      return Promise.resolve([]);
    };
    query.transaction = async (callback: (transaction: typeof query) => Array<Promise<unknown>>) =>
      Promise.all(callback(query));
    return query;
  },
}));

import { GET as getMasterTags } from "../../apps/web/app/api/automation/v1/master/tags/route";
import { POST as createTag } from "../../apps/web/app/api/automation/v1/tags/route";

const token = "test-only-automation-token";
const originalHash = process.env.AUTOMATION_API_TOKEN_SHA256;
const originalScopes = process.env.AUTOMATION_API_SCOPES;
const originalDatabaseUrl = process.env.DATABASE_URL;

beforeEach(() => {
  databaseMock.tag = null;
  process.env.AUTOMATION_API_TOKEN_SHA256 = createHash("sha256").update(token).digest("hex");
  process.env.AUTOMATION_API_SCOPES = "tag:create,master:read";
  process.env.DATABASE_URL = "postgres://test-only";
});

afterEach(() => {
  for (const [name, original] of [
    ["AUTOMATION_API_TOKEN_SHA256", originalHash],
    ["AUTOMATION_API_SCOPES", originalScopes],
    ["DATABASE_URL", originalDatabaseUrl],
  ] as const) {
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
});

describe("automation tag create and master read", () => {
  it("returns the newly created tag with the same ID, key, translations, and zero usage", async () => {
    const headers = { authorization: `Bearer ${token}` };
    const created = await createTag(
      new Request("https://example.com/api/automation/v1/tags", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ key: "live-music", translations: { ja: "ライブ音楽", en: "Live Music" } }),
      }),
    );
    expect(created.status).toBe(201);
    const createdTag = (await created.json()).tag;
    expect(createdTag.id).toMatch(/^[0-9a-f]{8}-[0-9a-f-]{27}$/i);

    const master = await getMasterTags(new Request("https://example.com/api/automation/v1/master/tags", { headers }));
    expect(master.status).toBe(200);
    await expect(master.json()).resolves.toEqual({
      tags: [
        {
          id: createdTag.id,
          key: "live-music",
          translations: { ja: "ライブ音楽", en: "Live Music" },
          pubCount: 0,
        },
      ],
    });
  });
});
