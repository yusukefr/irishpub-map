import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  contentType: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
  update: vi.fn(),
  publication: vi.fn(),
  configured: vi.fn(),
}));
vi.mock("../../apps/web/app/lib/admin-api", () => ({
  getAdminApiAuthorizationError: mocks.auth,
  getAdminJsonContentTypeError: mocks.contentType,
  adminApiErrorResponse: (code: string, status: number) => Response.json({ errorCode: code }, { status }),
}));
vi.mock("../../apps/web/app/lib/admin-quiz-service", () => ({
  createAdminQuiz: mocks.create,
  readAdminQuizList: mocks.list,
  readAdminQuiz: mocks.read,
  updateAdminQuiz: mocks.update,
  changeAdminQuizPublication: mocks.publication,
}));
vi.mock("../../apps/web/app/lib/quiz/repository", () => ({ isQuizDatabaseConfigured: mocks.configured }));
import { GET as listGet, POST } from "../../apps/web/app/api/admin/quiz/route";
import { GET as detailGet, PUT } from "../../apps/web/app/api/admin/quiz/[id]/route";
import { PATCH } from "../../apps/web/app/api/admin/quiz/[id]/publication/route";
const request = (url: string, init?: RequestInit) => new Request(url, init);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockReturnValue(null);
  mocks.contentType.mockReturnValue(null);
  mocks.configured.mockReturnValue(true);
  mocks.list.mockResolvedValue([]);
  mocks.create.mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440015" });
  mocks.read.mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440010" });
  mocks.update.mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440010" });
  mocks.publication.mockResolvedValue({
    id: "550e8400-e29b-41d4-a716-446655440010",
    isPublished: true,
    unchanged: false,
  });
});
describe("admin quiz API", () => {
  it("returns both the list and database configuration state", async () => {
    mocks.list.mockResolvedValue([{ id: "550e8400-e29b-41d4-a716-446655440010" }]);
    const response = await listGet(request("https://example.test/api/admin/quiz"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      questions: [{ id: "550e8400-e29b-41d4-a716-446655440010" }],
      databaseConfigured: true,
    });
  });
  it("requires authentication before a mutation", async () => {
    mocks.auth.mockReturnValue(Response.json({ errorCode: "unauthorized" }, { status: 401 }));
    const response = await POST(
      request("https://example.test/api/admin/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "https://example.test" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects an invalid content type and creates a draft", async () => {
    mocks.contentType.mockReturnValueOnce(Response.json({ errorCode: "invalid_content_type" }, { status: 415 }));
    const invalid = await POST(
      request("https://example.test/api/admin/quiz", {
        method: "POST",
        headers: { origin: "https://example.test" },
        body: "{}",
      }),
    );
    expect(invalid.status).toBe(415);
    const response = await POST(
      request("https://example.test/api/admin/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json", origin: "https://example.test" },
        body: "{}",
      }),
    );
    expect(response.status).toBe(201);
  });
  it("handles detail update and publication routes", async () => {
    const context = { params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440010" }) };
    expect(
      (await detailGet(request("https://example.test/api/admin/quiz/550e8400-e29b-41d4-a716-446655440010"), context))
        .status,
    ).toBe(200);
    expect(
      (
        await PUT(
          request("https://example.test/api/admin/quiz/550e8400-e29b-41d4-a716-446655440010", {
            method: "PUT",
            headers: { "Content-Type": "application/json", origin: "https://example.test" },
            body: "{}",
          }),
          context,
        )
      ).status,
    ).toBe(200);
    const response = await PATCH(
      request("https://example.test/api/admin/quiz/550e8400-e29b-41d4-a716-446655440010/publication", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", origin: "https://example.test" },
        body: JSON.stringify({ isPublished: true }),
      }),
      context,
    );
    expect(response.status).toBe(200);
    expect(mocks.publication).toHaveBeenCalledWith("550e8400-e29b-41d4-a716-446655440010", true);
  });
  it("rejects legacy non-UUID detail paths", async () => {
    const context = { params: Promise.resolve({ id: "legacy-question" }) };
    const response = await detailGet(request("https://example.test/api/admin/quiz/legacy-question"), context);
    expect(response.status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
