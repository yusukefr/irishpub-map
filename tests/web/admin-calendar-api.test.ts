import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  contentType: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  publication: vi.fn(),
  configured: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/admin-api", () => ({
  getAdminApiAuthorizationError: mocks.auth,
  getAdminJsonContentTypeError: mocks.contentType,
  adminApiErrorResponse: (code: string, status: number) => Response.json({ errorCode: code }, { status }),
}));
vi.mock("../../apps/web/app/lib/admin-calendar-service", () => ({
  createAdminCalendarEvent: mocks.create,
  readAdminCalendarList: mocks.list,
  readAdminCalendarEvent: mocks.read,
  updateAdminCalendarEvent: mocks.update,
  deleteAdminCalendarEvent: mocks.remove,
  changeAdminCalendarEventPublication: mocks.publication,
}));
vi.mock("../../apps/web/app/lib/calendar/repository", () => ({ isCalendarDatabaseConfigured: mocks.configured }));

import { GET as listGet, POST } from "../../apps/web/app/api/admin/calendar/route";
import { DELETE, GET as detailGet, PUT } from "../../apps/web/app/api/admin/calendar/[id]/route";
import { PATCH } from "../../apps/web/app/api/admin/calendar/[id]/publication/route";

const request = (url: string, init?: RequestInit) => new Request(url, init);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockReturnValue(null);
  mocks.contentType.mockReturnValue(null);
  mocks.configured.mockReturnValue(true);
  mocks.list.mockResolvedValue([]);
  mocks.create.mockResolvedValue({ id: "new-event" });
  mocks.read.mockResolvedValue({ id: "8acbc777-5160-4f1d-8284-6db05f89485d" });
  mocks.update.mockResolvedValue({ id: "8acbc777-5160-4f1d-8284-6db05f89485d" });
  mocks.remove.mockResolvedValue({ id: "8acbc777-5160-4f1d-8284-6db05f89485d", wasPublished: false });
  mocks.publication.mockResolvedValue({
    id: "8acbc777-5160-4f1d-8284-6db05f89485d",
    isPublished: true,
    unchanged: false,
  });
});

describe("admin calendar API", () => {
  it("returns the event list and database configuration state", async () => {
    mocks.list.mockResolvedValue([{ id: "8acbc777-5160-4f1d-8284-6db05f89485d" }]);

    await expect(
      listGet(request("https://example.test/api/admin/calendar")).then((response) => response.json()),
    ).resolves.toEqual({
      events: [{ id: "8acbc777-5160-4f1d-8284-6db05f89485d" }],
      databaseConfigured: true,
    });
  });

  it("requires authentication and JSON Content-Type before creating", async () => {
    mocks.auth.mockReturnValue(Response.json({ errorCode: "unauthorized" }, { status: 401 }));
    const unauthorized = await POST(
      request("https://example.test/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "https://example.test" },
        body: "{}",
      }),
    );
    expect(unauthorized.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();

    mocks.auth.mockReturnValue(null);
    mocks.contentType.mockReturnValue(Response.json({ errorCode: "invalid_content_type" }, { status: 415 }));
    const invalidContentType = await POST(request("https://example.test/api/admin/calendar", { method: "POST" }));
    expect(invalidContentType.status).toBe(415);

    mocks.contentType.mockReturnValue(null);
    const created = await POST(
      request("https://example.test/api/admin/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "https://example.test" },
        body: "{}",
      }),
    );
    expect(created.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({});
  });

  it("connects detail, update, delete, and publication routes", async () => {
    const context = { params: Promise.resolve({ id: "8acbc777-5160-4f1d-8284-6db05f89485d" }) };
    expect(
      (
        await detailGet(
          request("https://example.test/api/admin/calendar/8acbc777-5160-4f1d-8284-6db05f89485d"),
          context,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await PUT(
          request("https://example.test/api/admin/calendar/8acbc777-5160-4f1d-8284-6db05f89485d", {
            method: "PUT",
            headers: { "Content-Type": "application/json", origin: "https://example.test" },
            body: "{}",
          }),
          context,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await PATCH(
          request("https://example.test/api/admin/calendar/8acbc777-5160-4f1d-8284-6db05f89485d/publication", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", origin: "https://example.test" },
            body: JSON.stringify({ isPublished: true }),
          }),
          context,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await DELETE(
          request("https://example.test/api/admin/calendar/8acbc777-5160-4f1d-8284-6db05f89485d", {
            method: "DELETE",
            headers: { origin: "https://example.test" },
          }),
          context,
        )
      ).status,
    ).toBe(200);
    expect(mocks.publication).toHaveBeenCalledWith("8acbc777-5160-4f1d-8284-6db05f89485d", true);
  });

  it("rejects malformed event IDs before calling the service", async () => {
    const context = { params: Promise.resolve({ id: "st-patricks-day" }) };
    const response = await detailGet(request("https://example.test/api/admin/calendar/st-patricks-day"), context);

    expect(response.status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
