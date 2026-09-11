import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  readAdminContentList: vi.fn(),
  readAdminContent: vi.fn(),
  isContentDatabaseConfigured: vi.fn(),
  isE2ETestMode: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("../../apps/web/app/lib/admin-server", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("../../apps/web/app/lib/admin-content-service", async () => {
  class AdminContentServiceError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  return {
    AdminContentServiceError,
    readAdminContentList: mocks.readAdminContentList,
    readAdminContent: mocks.readAdminContent,
  };
});
vi.mock("../../apps/web/app/lib/admin-content-repository", () => ({
  isContentDatabaseConfigured: mocks.isContentDatabaseConfigured,
}));
vi.mock("../../apps/web/app/lib/e2e-test-mode", () => ({ isE2ETestMode: mocks.isE2ETestMode }));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: () => Promise.resolve("ja") }));
vi.mock("../../apps/web/app/components/admin-content-editor", () => ({
  AdminContentEditor: ({ initialContent }: { initialContent: { translations: { ja: { title: string } } } | null }) => (
    <p>{initialContent?.translations.ja.title ?? "new content"}</p>
  ),
}));

import AdminContentPage from "../../apps/web/app/admin/(protected)/content/page";
import EditAdminContentPage from "../../apps/web/app/admin/(protected)/content/[id]/page";
import NewAdminContentPage from "../../apps/web/app/admin/(protected)/content/new/page";

const content = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  kind: "guide" as const,
  slug: "pub-etiquette",
  category: "pub-culture" as const,
  status: "draft" as const,
  publishedAt: null,
  titleJa: "パブの作法",
  titleEn: "Pub etiquette",
  createdAt: "2026-09-11T00:00:00.000Z",
  updatedAt: "2026-09-11T01:00:00.000Z",
};

beforeEach(() => {
  mocks.requireAdminSession.mockReset().mockResolvedValue(undefined);
  mocks.readAdminContentList.mockReset().mockResolvedValue([]);
  mocks.readAdminContent.mockReset();
  mocks.isContentDatabaseConfigured.mockReset().mockReturnValue(true);
  mocks.isE2ETestMode.mockReset().mockReturnValue(false);
  mocks.notFound.mockReset();
});

describe("Admin Content pages", () => {
  it("認証後にDraftを含む一覧と編集導線を表示する", async () => {
    mocks.readAdminContentList.mockResolvedValue([content]);
    render(await AdminContentPage());

    expect(mocks.requireAdminSession.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.readAdminContentList.mock.invocationCallOrder[0],
    );
    expect(screen.getByRole("heading", { name: "Content管理" })).toBeInTheDocument();
    expect(screen.getByText("下書き")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "編集" })).toHaveAttribute("href", `/admin/content/${content.id}`);
  });

  it("認証に失敗した場合はContentを取得しない", async () => {
    mocks.requireAdminSession.mockRejectedValue(new Error("redirect:/admin/login"));
    await expect(AdminContentPage()).rejects.toThrow("redirect:/admin/login");
    expect(mocks.readAdminContentList).not.toHaveBeenCalled();
  });

  it("新規画面と既存Content編集画面を共通Editorへ渡す", async () => {
    render(await NewAdminContentPage());
    expect(screen.getByText("new content")).toBeInTheDocument();

    const detail = {
      ...content,
      translations: {
        ja: { title: content.titleJa, summary: "要約", bodyMarkdown: "# 本文" },
        en: { title: content.titleEn, summary: "Summary", bodyMarkdown: "# Body" },
      },
    };
    mocks.readAdminContent.mockResolvedValue(detail);
    const { unmount } = render(await EditAdminContentPage({ params: Promise.resolve({ id: content.id }) }));
    expect(screen.getByText(content.titleJa)).toBeInTheDocument();
    unmount();
  });
});
