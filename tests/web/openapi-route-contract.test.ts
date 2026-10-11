import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_COOKIE, createAdminSession } from "../../apps/web/app/lib/admin-auth";
import { expectOpenApiResponse, getOpenApiOperation } from "../helpers/openapi-contract";

const mocks = vi.hoisted(() => ({
  listCalendar: vi.fn(),
  databaseConfigured: vi.fn(),
  getPrefectures: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/admin-calendar-service", () => ({ readAdminCalendarList: mocks.listCalendar }));
vi.mock("../../apps/web/app/lib/calendar/repository", () => ({
  isCalendarDatabaseConfigured: mocks.databaseConfigured,
}));
vi.mock("../../apps/web/app/lib/master-repository", () => ({ getPrefectures: mocks.getPrefectures }));

import { GET as getAdminCalendar } from "../../apps/web/app/api/admin/calendar/route";
import { GET as getAutomationPrefectures } from "../../apps/web/app/api/automation/v1/master/prefectures/route";

const automationToken = "contract-test-token";
const calendarEvent = {
  id: "8acbc777-5160-4f1d-8284-6db05f89485d",
  category: "culture",
  dateRule: null,
  isPublicHoliday: false,
  featured: false,
  aliases: [],
  source: null,
  sortOrder: 0,
  isPublished: false,
  nameJa: "文化の日",
  nameEn: "Culture Day",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const originalTokenHash = process.env.AUTOMATION_API_TOKEN_SHA256;
const originalScopes = process.env.AUTOMATION_API_SCOPES;
const originalAdminEnv = {
  username: process.env.ADMIN_USERNAME,
  passwordHash: process.env.ADMIN_PASSWORD_HASH,
  sessionSecret: process.env.ADMIN_SESSION_SECRET,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listCalendar.mockResolvedValue([calendarEvent]);
  mocks.databaseConfigured.mockReturnValue(true);
  mocks.getPrefectures.mockResolvedValue([]);
  process.env.AUTOMATION_API_TOKEN_SHA256 = createHash("sha256").update(automationToken).digest("hex");
  process.env.AUTOMATION_API_SCOPES = "master:read";
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD_HASH = "test-only-hash";
  process.env.ADMIN_SESSION_SECRET = "test-only-session-secret";
});

afterEach(() => {
  if (originalTokenHash === undefined) delete process.env.AUTOMATION_API_TOKEN_SHA256;
  else process.env.AUTOMATION_API_TOKEN_SHA256 = originalTokenHash;
  if (originalScopes === undefined) delete process.env.AUTOMATION_API_SCOPES;
  else process.env.AUTOMATION_API_SCOPES = originalScopes;
  if (originalAdminEnv.username === undefined) delete process.env.ADMIN_USERNAME;
  else process.env.ADMIN_USERNAME = originalAdminEnv.username;
  if (originalAdminEnv.passwordHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
  else process.env.ADMIN_PASSWORD_HASH = originalAdminEnv.passwordHash;
  if (originalAdminEnv.sessionSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = originalAdminEnv.sessionSecret;
});

describe("OpenAPI runtime contracts", () => {
  it("checks the Admin Calendar success and unauthorized responses from its Route Handler", async () => {
    const operation = await getOpenApiOperation("/api/admin/calendar", "get");
    expect(operation.security).toEqual([{ AdminSession: [] }]);
    const request = (authenticated = true) =>
      new Request("https://example.test/api/admin/calendar", {
        ...(authenticated ? { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${createAdminSession("admin")}` } } : {}),
      });

    const success = await getAdminCalendar(request());
    expect(success.status).toBe(200);
    await expect(expectOpenApiResponse(success, operation)).resolves.toEqual({
      events: [calendarEvent],
      databaseConfigured: true,
    });

    mocks.listCalendar.mockResolvedValue([{ ...calendarEvent, id: "st-patricks-day" }]);
    const driftedId = await getAdminCalendar(request());
    await expect(expectOpenApiResponse(driftedId, operation)).rejects.toThrow(
      /listAdminCalendarEvents HTTP 200: \/events\/0\/id/,
    );

    mocks.listCalendar.mockResolvedValue([calendarEvent]);
    const unauthorized = await getAdminCalendar(request(false));
    expect(unauthorized.status).toBe(401);
    await expect(expectOpenApiResponse(unauthorized, operation)).resolves.toEqual({ errorCode: "unauthorized" });
  });

  it("checks the Automation bearer and scope boundary plus its success response", async () => {
    const operation = await getOpenApiOperation("/api/automation/v1/master/prefectures", "get");
    expect(operation.security).toEqual([{ AutomationBearer: [] }]);
    expect(operation["x-required-scope"]).toBe("master:read");

    const unauthorized = await getAutomationPrefectures(
      new Request("https://example.test/api/automation/v1/master/prefectures"),
    );
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("www-authenticate")).toBe("Bearer");
    await expect(expectOpenApiResponse(unauthorized, operation)).resolves.toEqual({ errorCode: "unauthorized" });

    process.env.AUTOMATION_API_SCOPES = "tag:create";
    const forbidden = await getAutomationPrefectures(
      new Request("https://example.test/api/automation/v1/master/prefectures", {
        headers: { authorization: `Bearer ${automationToken}` },
      }),
    );
    expect(forbidden.status).toBe(403);
    await expect(expectOpenApiResponse(forbidden, operation)).resolves.toEqual({ errorCode: "forbidden" });

    process.env.AUTOMATION_API_SCOPES = "master:read";
    mocks.getPrefectures.mockResolvedValue([{ code: 23, name: "愛知県" }]);
    const success = await getAutomationPrefectures(
      new Request("https://example.test/api/automation/v1/master/prefectures", {
        headers: { authorization: `Bearer ${automationToken}` },
      }),
    );
    expect(success.status).toBe(200);
    await expect(expectOpenApiResponse(success, operation)).resolves.toEqual({
      prefectures: [{ code: 23, name: "愛知県" }],
    });
  });

  it("fails with a route and property path when runtime JSON drifts from OpenAPI", async () => {
    const operation = await getOpenApiOperation("/api/automation/v1/master/prefectures", "get");
    await expect(expectOpenApiResponse(Response.json({ prefectures: "not-an-array" }), operation)).rejects.toThrow(
      /listAutomationPrefectures HTTP 200: \/prefectures/,
    );
  });

  it.each([
    { prefectures: [{ code: "23", name: "愛知県" }] },
    { prefectures: [{ code: 23 }] },
    { prefectures: [{ code: 23, name: "愛知県", extra: true }] },
  ])("rejects Automation DTO drift: %o", async (body) => {
    const operation = await getOpenApiOperation("/api/automation/v1/master/prefectures", "get");
    await expect(expectOpenApiResponse(Response.json(body), operation)).rejects.toThrow(
      /listAutomationPrefectures HTTP 200: \/prefectures\/0/,
    );
  });
});
