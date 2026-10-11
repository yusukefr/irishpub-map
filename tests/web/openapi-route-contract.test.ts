import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectOpenApiResponse, getOpenApiOperation } from "../helpers/openapi-contract";

const mocks = vi.hoisted(() => ({
  adminAuth: vi.fn(),
  listCalendar: vi.fn(),
  databaseConfigured: vi.fn(),
  getPrefectures: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/admin-api", () => ({
  getAdminApiAuthorizationError: mocks.adminAuth,
  adminApiErrorResponse: (code: string, status: number) => Response.json({ errorCode: code }, { status }),
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.adminAuth.mockReturnValue(null);
  mocks.listCalendar.mockResolvedValue([calendarEvent]);
  mocks.databaseConfigured.mockReturnValue(true);
  mocks.getPrefectures.mockResolvedValue([]);
  process.env.AUTOMATION_API_TOKEN_SHA256 = createHash("sha256").update(automationToken).digest("hex");
  process.env.AUTOMATION_API_SCOPES = "master:read";
});

afterEach(() => {
  if (originalTokenHash === undefined) delete process.env.AUTOMATION_API_TOKEN_SHA256;
  else process.env.AUTOMATION_API_TOKEN_SHA256 = originalTokenHash;
  if (originalScopes === undefined) delete process.env.AUTOMATION_API_SCOPES;
  else process.env.AUTOMATION_API_SCOPES = originalScopes;
});

describe("OpenAPI runtime contracts", () => {
  it("checks the Admin Calendar success and unauthorized responses from its Route Handler", async () => {
    const operation = await getOpenApiOperation("/api/admin/calendar", "get");
    const request = () => new Request("https://example.test/api/admin/calendar");

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
    mocks.adminAuth.mockReturnValue(Response.json({ errorCode: "unauthorized" }, { status: 401 }));
    const unauthorized = await getAdminCalendar(request());
    expect(unauthorized.status).toBe(401);
    await expect(expectOpenApiResponse(unauthorized, operation)).resolves.toEqual({ errorCode: "unauthorized" });
  });

  it("checks the Automation bearer and scope boundary plus its success response", async () => {
    const operation = await getOpenApiOperation("/api/automation/v1/master/prefectures", "get");

    const unauthorized = await getAutomationPrefectures(
      new Request("https://example.test/api/automation/v1/master/prefectures"),
    );
    expect(unauthorized.status).toBe(401);
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
    const success = await getAutomationPrefectures(
      new Request("https://example.test/api/automation/v1/master/prefectures", {
        headers: { authorization: `Bearer ${automationToken}` },
      }),
    );
    expect(success.status).toBe(200);
    await expect(expectOpenApiResponse(success, operation)).resolves.toEqual({ prefectures: [] });
  });

  it("fails with a route and property path when runtime JSON drifts from OpenAPI", async () => {
    const operation = await getOpenApiOperation("/api/automation/v1/master/prefectures", "get");
    await expect(expectOpenApiResponse(Response.json({ prefectures: "not-an-array" }), operation)).rejects.toThrow(
      /listAutomationPrefectures HTTP 200: \/prefectures/,
    );
  });
});
