import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  type RecordValue = {
    id: string;
    request_hash: string;
    resource_id: string;
    status: "pending" | "completed";
    status_code: number | null;
    response_body: unknown;
    expires_at: number;
  };
  const keys = new Map<string, RecordValue>();
  const audits: Record<string, unknown>[] = [];
  return { keys, audits, now: Date.parse("2026-09-27T00:00:00Z"), stale: false };
});

vi.mock("../../apps/web/app/lib/automation-reliability-repository", () => ({
  claimAutomationKey: vi.fn(
    async (keyHash: string, requestHash: string, _method: string, _path: string, _type: string, resourceId: string) => {
      const previous = state.keys.get(keyHash);
      if (previous?.status === "completed" && previous.expires_at <= state.now) state.keys.delete(keyHash);
      const existing = state.keys.get(keyHash);
      if (existing) return { claimed: false, record: existing };
      const record = {
        id: resourceId,
        request_hash: requestHash,
        resource_id: resourceId,
        status: "pending" as const,
        status_code: null,
        response_body: null,
        expires_at: state.now + 24 * 60 * 60 * 1000,
      };
      state.keys.set(keyHash, record);
      return { claimed: true, record };
    },
  ),
  cleanupExpiredAutomationKeys: vi.fn(async () => {
    let deleted = 0;
    for (const [key, record] of state.keys) {
      if (record.status !== "completed" || record.expires_at > state.now) continue;
      state.keys.delete(key);
      deleted++;
      if (deleted === 100) break;
    }
    return deleted;
  }),
  completeAutomationKey: vi.fn(async (id: string, statusCode: number, body: unknown) => {
    const record = [...state.keys.values()].find((value) => value.id === id);
    if (!record) throw new Error("missing key");
    record.status = "completed";
    record.status_code = statusCode;
    record.response_body = body;
    record.expires_at = state.now + 24 * 60 * 60 * 1000;
  }),
  insertAutomationAudit: vi.fn(async (entry: Record<string, unknown>) => {
    state.audits.push(entry);
  }),
  releaseAutomationKey: vi.fn(async (id: string) => {
    for (const [key, record] of state.keys) if (record.id === id) state.keys.delete(key);
  }),
  takeOverStaleAutomationKey: vi.fn(async () => state.stale),
}));

import { handleAutomationCreate, handleAutomationMutation } from "../../apps/web/app/lib/automation-reliability";

const token = "test-only-automation-token";
const originalHash = process.env.AUTOMATION_API_TOKEN_SHA256;
const originalScopes = process.env.AUTOMATION_API_SCOPES;
const originalDatabaseUrl = process.env.DATABASE_URL;
const resourceTypes = [
  ["content", "content:create", "content"],
  ["quiz", "quiz:create", "question"],
  ["pubs", "pubs:create", "pub"],
  ["tags", "tag:create", "tag"],
] as const;

function request(path: string, method: string, body: unknown, key = "same-operation") {
  return new Request(`https://example.com/api/automation/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.keys.clear();
  state.audits.length = 0;
  state.now = Date.parse("2026-09-27T00:00:00Z");
  state.stale = false;
  process.env.AUTOMATION_API_TOKEN_SHA256 = createHash("sha256").update(token).digest("hex");
  process.env.AUTOMATION_API_SCOPES =
    "content:create,quiz:create,pubs:create,tag:create,content:update,content:publish,quiz:publish";
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

describe("automation reliability", () => {
  it.each(resourceTypes)("replays %s create and rejects a different body", async (path, scope, field) => {
    const created = new Map<string, unknown>();
    const execute = vi.fn(async (id: string) => {
      const value = { id, title: "sample" };
      created.set(id, value);
      return Response.json({ [field]: value }, { status: 201 });
    });
    const options = {
      scope,
      resourceType: field === "question" ? ("quiz" as const) : field,
      execute,
      recover: async (id: string) => created.get(id) ?? null,
    };
    const first = await handleAutomationCreate(request(path, "POST", { a: 1, b: 2 }), options);
    const retry = await handleAutomationCreate(request(path, "POST", { b: 2, a: 1 }), options);
    const conflict = await handleAutomationCreate(request(path, "POST", { a: 3 }), options);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(await retry.json()).toEqual(await first.json());
    expect(first.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/u);
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({ errorCode: "idempotency_conflict" });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(created.size).toBe(1);
    expect(state.audits).toHaveLength(2);
    expect(JSON.stringify(state.audits)).not.toContain(token);
  });

  it("requires a valid key after authentication", async () => {
    const options = {
      scope: "content:create" as const,
      resourceType: "content" as const,
      execute: vi.fn(async () => Response.json({ content: {} }, { status: 201 })),
      recover: async () => null,
    };
    const missing = request("content", "POST", {});
    missing.headers.delete("Idempotency-Key");
    await expect((await handleAutomationCreate(missing, options)).json()).resolves.toEqual({
      errorCode: "idempotency_key_required",
    });
    // Fetch Headersは外側の空白を受信前に除去するため、観測可能な不正値を検査します。
    for (const key of ["", "x".repeat(129), "a\tb"]) {
      const response = await handleAutomationCreate(request("content", "POST", {}, key), options);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ errorCode: "invalid_idempotency_key" });
    }
    expect(options.execute).not.toHaveBeenCalled();
  });

  it("prevents concurrent create and recovers after a lost response", async () => {
    const created = new Map<string, unknown>();
    let releaseFirst: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const execute = vi.fn(async (id: string) => {
      created.set(id, { id });
      await gate;
      return Response.json({ content: { id } }, { status: 201 });
    });
    const options = {
      scope: "content:create" as const,
      resourceType: "content" as const,
      execute,
      recover: async (id: string) => created.get(id) ?? null,
    };
    const first = handleAutomationCreate(request("content", "POST", {}), options);
    // claimが確保されるまで次のmicrotaskへ進めます。
    await vi.waitFor(() => expect(state.keys.size).toBe(1));
    const concurrent = await handleAutomationCreate(request("content", "POST", {}), options);
    expect(concurrent.status).toBe(409);
    await expect(concurrent.json()).resolves.toEqual({ errorCode: "idempotency_in_progress" });
    releaseFirst?.();
    expect((await first).status).toBe(201);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(created.size).toBe(1);
  });

  it("does not cache a failed create and recovers an already persisted resource", async () => {
    const created = new Map<string, unknown>();
    const execute = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ errorCode: "validation_error" }, { status: 422 }))
      .mockImplementationOnce(async (id: string) => {
        created.set(id, { id });
        return Response.json({ errorCode: "internal_error" }, { status: 500 });
      });
    const options = {
      scope: "content:create" as const,
      resourceType: "content" as const,
      execute,
      recover: async (id: string) => created.get(id) ?? null,
    };
    expect((await handleAutomationCreate(request("content", "POST", {}), options)).status).toBe(422);
    expect(state.keys.size).toBe(0);
    const recovered = await handleAutomationCreate(request("content", "POST", {}), options);
    expect(recovered.status).toBe(201);
    expect(state.keys.size).toBe(1);
    expect([...state.keys.values()][0].status).toBe("completed");
    const retry = await handleAutomationCreate(request("content", "POST", {}), options);
    expect(await retry.json()).toEqual(await recovered.json());
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("releases a failed create when no resource was persisted", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ errorCode: "internal_error" }, { status: 500 }))
      .mockImplementationOnce(async (id: string) => Response.json({ content: { id } }, { status: 201 }));
    const options = {
      scope: "content:create" as const,
      resourceType: "content" as const,
      execute,
      recover: async () => null,
    };
    const failure = await handleAutomationCreate(request("content", "POST", {}), options);
    expect(failure.status).toBe(500);
    expect(state.keys.size).toBe(0);
    expect(state.audits.at(-1)).toMatchObject({ result: "failure", statusCode: 500 });
    expect((await handleAutomationCreate(request("content", "POST", {}), options)).status).toBe(201);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("reuses an expired completed key as a new create without touching the old resource", async () => {
    const created = new Map<string, unknown>();
    const options = {
      scope: "content:create" as const,
      resourceType: "content" as const,
      execute: async (id: string) => {
        created.set(id, { id });
        return Response.json({ content: { id } }, { status: 201 });
      },
      recover: async (id: string) => created.get(id) ?? null,
    };
    const first = await handleAutomationCreate(request("content", "POST", {}), options);
    state.now += 24 * 60 * 60 * 1000 + 1;
    const second = await handleAutomationCreate(request("content", "POST", {}), options);
    expect(created.size).toBe(2);
    expect(await second.json()).not.toEqual(await first.json());
  });

  it("checks the target key even when batch cleanup leaves it behind", async () => {
    const execute = vi.fn(async (id: string) => Response.json({ content: { id } }, { status: 201 }));
    const options = {
      scope: "content:create" as const,
      resourceType: "content" as const,
      execute,
      recover: async () => null,
    };
    const first = await handleAutomationCreate(request("content", "POST", {}), options);
    const [keyHash, oldRecord] = [...state.keys.entries()][0];
    state.keys.clear();
    state.now += 24 * 60 * 60 * 1000 + 1;
    for (let index = 0; index < 101; index++) {
      state.keys.set(`older-${index}`, { ...oldRecord, id: `older-${index}` });
    }
    state.keys.set(keyHash, oldRecord);

    const second = await handleAutomationCreate(request("content", "POST", {}), options);
    expect(second.status).toBe(201);
    expect(await second.json()).not.toEqual(await first.json());
    expect(execute).toHaveBeenCalledTimes(2);
    expect([...state.keys.values()].filter((record) => record.status === "completed")).toHaveLength(2);
  });

  it("extends expiry after recovering a pending resource older than 24 hours", async () => {
    let resource: { id: string } | null = null;
    const execute = vi.fn(async (id: string) => {
      resource = { id };
      return Response.json({ errorCode: "internal_error" }, { status: 500 });
    });
    let recoveryAttempts = 0;
    const options = {
      scope: "content:create" as const,
      resourceType: "content" as const,
      execute,
      recover: async () => {
        recoveryAttempts++;
        if (recoveryAttempts === 1) throw new Error("temporary read failure");
        return resource;
      },
    };
    const first = await handleAutomationCreate(request("content", "POST", {}), options);
    expect(first.status).toBe(500);
    expect([...state.keys.values()][0].status).toBe("pending");

    state.now += 25 * 60 * 60 * 1000;
    state.stale = true;
    const recovered = await handleAutomationCreate(request("content", "POST", {}), options);
    expect(recovered.status).toBe(201);
    expect([...state.keys.values()][0].expires_at).toBe(state.now + 24 * 60 * 60 * 1000);

    const retry = await handleAutomationCreate(request("content", "POST", {}), options);
    expect(await retry.json()).toEqual(await recovered.json());
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("audits slug-based quiz unpublish metadata without request body or bearer token", async () => {
    const id = "history-question";
    const response = await handleAutomationMutation(
      request(`quiz/${id}/publication`, "PATCH", { isPublished: false }),
      {
        scope: "quiz:publish",
        resourceType: "quiz",
        resourceId: id,
        execute: async () => Response.json({ publication: { id, isPublished: false } }),
      },
    );
    expect(response.headers.get("X-Request-Id")).toBe(state.audits[0].requestId);
    expect(state.audits[0]).toMatchObject({
      scope: "quiz:publish",
      method: "PATCH",
      path: "/api/automation/v1/quiz/:id/publication",
      resourceType: "quiz",
      resourceId: id,
      action: "unpublish",
      result: "success",
      statusCode: 200,
    });
    expect(JSON.stringify(state.audits)).not.toContain(token);
    expect(JSON.stringify(state.audits)).not.toContain("isPublished");
  });
});
