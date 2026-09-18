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
  mocks.read.mockResolvedValue({ id: "event-one" });
  mocks.update.mockResolvedValue({ id: "event-one" });
  mocks.remove.mockResolvedValue({ id: "event-one", wasPublished: false });
  mocks.publication.mockResolvedValue({ id: "event-one", isPublished: true, unchanged: false });
});

describe("admin calendar API", () => {
  it("returns the event list and database configuration state", async () => {
    mocks.list.mockResolvedValue([{ id: "event-one" }]);

    await expect(
      listGet(request("https://example.test/api/admin/calendar")).then((response) => response.json()),
    ).resolves.toEqual({
      events: [{ id: "event-one" }],
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
    const context = { params: Promise.resolve({ id: "event-one" }) };
    expect((await detailGet(request("https://example.test/api/admin/calendar/event-one"), context)).status).toBe(200);
    expect(
      (
        await PUT(
          request("https://example.test/api/admin/calendar/event-one", {
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
          request("https://example.test/api/admin/calendar/event-one/publication", {
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
          request("https://example.test/api/admin/calendar/event-one", {
            method: "DELETE",
            headers: { origin: "https://example.test" },
          }),
          context,
        )
      ).status,
    ).toBe(200);
    expect(mocks.publication).toHaveBeenCalledWith("event-one", true);
  });

  it("rejects malformed event IDs before calling the service", async () => {
    const context = { params: Promise.resolve({ id: "Invalid ID" }) };
    const response = await detailGet(request("https://example.test/api/admin/calendar/Invalid%20ID"), context);

    expect(response.status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
