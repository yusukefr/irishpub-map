import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  readAdminQuizList: vi.fn(),
  readAdminQuiz: vi.fn(),
  isQuizDatabaseConfigured: vi.fn(),
  readAdminContentList: vi.fn(),
  notFound: vi.fn(),
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("../../apps/web/app/lib/admin-server", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("../../apps/web/app/lib/admin-quiz-service", () => ({
  readAdminQuizList: mocks.readAdminQuizList,
  readAdminQuiz: mocks.readAdminQuiz,
  AdminQuizServiceError: class AdminQuizServiceError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));
vi.mock("../../apps/web/app/lib/quiz/repository", () => ({ isQuizDatabaseConfigured: mocks.isQuizDatabaseConfigured }));
vi.mock("../../apps/web/app/lib/admin-content-service", () => ({ readAdminContentList: mocks.readAdminContentList }));
vi.mock("../../apps/web/app/lib/e2e-test-mode", () => ({ isE2ETestMode: () => false }));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: () => Promise.resolve("ja") }));
vi.mock("../../apps/web/app/components/admin-quiz-editor", () => ({
  AdminQuizEditor: ({ initialQuestion }: { initialQuestion: { id: string } | null }) => (
    <p>{initialQuestion?.id ?? "new quiz"}</p>
  ),
}));
import AdminQuizPage from "../../apps/web/app/admin/(protected)/quiz/page";
import NewAdminQuizPage from "../../apps/web/app/admin/(protected)/quiz/new/page";
import EditAdminQuizPage from "../../apps/web/app/admin/(protected)/quiz/[id]/page";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminSession.mockResolvedValue(undefined);
  mocks.readAdminQuizList.mockResolvedValue([]);
  mocks.readAdminQuiz.mockResolvedValue({ id: "550e8400-e29b-41d4-a716-446655440010" });
  mocks.isQuizDatabaseConfigured.mockReturnValue(true);
  mocks.readAdminContentList.mockResolvedValue([]);
});
describe("Admin Quiz pages", () => {
  it("renders the list and edit link after authentication", async () => {
    mocks.readAdminQuizList.mockResolvedValue([
      {
        id: "550e8400-e29b-41d4-a716-446655440010",
        category: "history",
        specialDate: null,
        isPublished: false,
        questionJa: "問題",
        questionEn: "Question",
        choiceCount: 4,
        correctChoiceId: null,
        sourceUrl: null,
        relatedContentId: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    render(await AdminQuizPage());
    expect(mocks.requireAdminSession).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Quiz管理" })).toBeInTheDocument();
    expect(screen.getByText("下書き")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "編集" })).toHaveAttribute(
      "href",
      "/admin/quiz/550e8400-e29b-41d4-a716-446655440010",
    );
  });
  it("passes new and existing questions to the shared editor", async () => {
    render(await NewAdminQuizPage());
    expect(screen.getByText("new quiz")).toBeInTheDocument();
    render(await EditAdminQuizPage({ params: Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440010" }) }));
    expect(screen.getByText("550e8400-e29b-41d4-a716-446655440010")).toBeInTheDocument();
  });
});
