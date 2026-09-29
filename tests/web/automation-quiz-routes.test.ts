import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Business Routeの既存契約を確認するテスト。冪等性と監査は専用テストで検証します。
vi.mock("../../apps/web/app/lib/automation-reliability", () => ({
  handleAutomationCreate: (_request: Request, options: { execute: (id: string) => Promise<Response> }) =>
    options.execute("550e8400-e29b-41d4-a716-446655440001"),
  handleAutomationMutation: (_request: Request, options: { execute: () => Promise<Response> }) => options.execute(),
}));

const mocks = vi.hoisted(() => ({
  changeAdminQuizPublication: vi.fn(),
  createAdminQuiz: vi.fn(),
  isQuizDatabaseConfigured: vi.fn(),
  readAdminQuiz: vi.fn(),
  readAdminQuizList: vi.fn(),
  updateAdminQuiz: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/admin-quiz-service", () => ({
  changeAdminQuizPublication: mocks.changeAdminQuizPublication,
  createAdminQuiz: mocks.createAdminQuiz,
  readAdminQuiz: mocks.readAdminQuiz,
  readAdminQuizList: mocks.readAdminQuizList,
  updateAdminQuiz: mocks.updateAdminQuiz,
}));
vi.mock("../../apps/web/app/lib/quiz/repository", () => ({
  isQuizDatabaseConfigured: mocks.isQuizDatabaseConfigured,
}));

import { GET as getQuizList, POST as createQuiz } from "../../apps/web/app/api/automation/v1/quiz/route";
import { GET as getQuiz, PUT as updateQuiz } from "../../apps/web/app/api/automation/v1/quiz/[id]/route";
import { PATCH as changePublication } from "../../apps/web/app/api/automation/v1/quiz/[id]/publication/route";

const token = "test-only-automation-token";
const originalHash = process.env.AUTOMATION_API_TOKEN_SHA256;
const originalScopes = process.env.AUTOMATION_API_SCOPES;
const originalDatabaseUrl = process.env.DATABASE_URL;

function request(method: string, scopes: string, body?: unknown) {
  process.env.AUTOMATION_API_SCOPES = scopes;
  return new Request("https://example.com/api/automation/v1/quiz", {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const context = { params: Promise.resolve({ id: "history-question" }) };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTOMATION_API_TOKEN_SHA256 = createHash("sha256").update(token).digest("hex");
  process.env.AUTOMATION_API_SCOPES = "quiz:read,quiz:create,quiz:update,quiz:publish";
  process.env.DATABASE_URL = "postgres://test-only";
  mocks.isQuizDatabaseConfigured.mockReturnValue(true);
  mocks.readAdminQuizList.mockResolvedValue([{ id: "history-question", isPublished: false }]);
  mocks.readAdminQuiz.mockResolvedValue({ id: "history-question", isPublished: false });
  mocks.createAdminQuiz.mockResolvedValue({ id: "server-generated-id", isPublished: false });
  mocks.updateAdminQuiz.mockResolvedValue({ id: "history-question", isPublished: false });
  mocks.changeAdminQuizPublication.mockResolvedValue({ id: "history-question", isPublished: true, unchanged: false });
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

describe("automation quiz routes", () => {
  it("returns the admin quiz list and detail through quiz:read", async () => {
    const list = await getQuizList(request("GET", "quiz:read"));
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toEqual({ questions: [{ id: "history-question", isPublished: false }] });

    const detail = await getQuiz(request("GET", "quiz:read"), context);
    expect(detail.status).toBe(200);
    await expect(detail.json()).resolves.toEqual({ question: { id: "history-question", isPublished: false } });
    expect(mocks.readAdminQuiz).toHaveBeenCalledWith("history-question");
  });

  it("returns database_unavailable instead of an empty list when the database is not configured", async () => {
    mocks.isQuizDatabaseConfigured.mockReturnValue(false);

    const response = await getQuizList(request("GET", "quiz:read"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ errorCode: "database_unavailable" });
    expect(mocks.readAdminQuizList).not.toHaveBeenCalled();
  });

  it("creates a Draft through the shared service and returns its server-generated ID", async () => {
    const payload = { category: "history", translations: { ja: {}, en: {} }, choices: [] };
    const response = await createQuiz(request("POST", "quiz:create", payload));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ question: { id: "server-generated-id", isPublished: false } });
    expect(mocks.createAdminQuiz).toHaveBeenCalledWith(payload, "550e8400-e29b-41d4-a716-446655440001");
  });

  it("updates through the shared service while retaining the response publication state", async () => {
    const payload = { category: "history", translations: { ja: {}, en: {} }, choices: [] };
    const response = await updateQuiz(request("PUT", "quiz:update", payload), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ question: { id: "history-question", isPublished: false } });
    expect(mocks.updateAdminQuiz).toHaveBeenCalledWith("history-question", payload);
  });

  it("accepts only a boolean isPublished field for publication changes", async () => {
    const response = await changePublication(request("PATCH", "quiz:publish", { isPublished: true }), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      publication: { id: "history-question", isPublished: true, unchanged: false },
    });
    expect(mocks.changeAdminQuizPublication).toHaveBeenCalledWith("history-question", true);

    const extraField = await changePublication(
      request("PATCH", "quiz:publish", { isPublished: true, id: "chosen-by-client" }),
      context,
    );
    expect(extraField.status).toBe(422);
    expect(mocks.changeAdminQuizPublication).toHaveBeenCalledTimes(1);

    const nonBoolean = await changePublication(request("PATCH", "quiz:publish", { isPublished: "true" }), context);
    expect(nonBoolean.status).toBe(422);
  });

  it.each([
    ["list", "quiz:create", () => getQuizList(request("GET", "quiz:create"))],
    ["detail", "quiz:update", () => getQuiz(request("GET", "quiz:update"), context)],
    ["create", "quiz:read", () => createQuiz(request("POST", "quiz:read", {}))],
    ["update", "quiz:create", () => updateQuiz(request("PUT", "quiz:create", {}), context)],
    [
      "publication",
      "quiz:update",
      () => changePublication(request("PATCH", "quiz:update", { isPublished: true }), context),
    ],
  ])("does not inherit permissions for %s from %s", async (_operation, _scope, call) => {
    const response = await call();
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ errorCode: "forbidden" });
  });

  it("returns 401 without a valid Bearer token", async () => {
    const response = await getQuizList(new Request("https://example.com/api/automation/v1/quiz"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ errorCode: "unauthorized" });
  });
});
