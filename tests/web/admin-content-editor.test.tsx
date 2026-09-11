import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminContent } from "@irishpub-map/shared/admin-content";
import { AdminContentEditor } from "../../apps/web/app/components/admin-content-editor";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const fetchMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.stubGlobal("fetch", fetchMock);

const content: AdminContent = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  kind: "guide",
  slug: "pub-etiquette",
  category: "pub-culture",
  status: "draft",
  publishedAt: null,
  translations: {
    ja: { title: "パブの作法", summary: "要約", bodyMarkdown: "## 本文" },
    en: { title: "Pub etiquette", summary: "Summary", bodyMarkdown: "## Body" },
  },
  createdAt: "2026-09-11T00:00:00.000Z",
  updatedAt: "2026-09-11T01:00:00.000Z",
};

beforeEach(() => {
  navigation.push.mockReset();
  navigation.refresh.mockReset();
  fetchMock.mockReset();
  vi.restoreAllMocks();
});

describe("AdminContentEditor", () => {
  it("入力中の日英Markdownを管理画面内で安全にPreviewする", () => {
    render(<AdminContentEditor initialContent={content} databaseConfigured locale="ja" />);
    const japanese = screen.getByRole("group", { name: "日本語" });
    fireEvent.change(within(japanese).getByLabelText("タイトル"), { target: { value: "Preview title" } });
    fireEvent.change(within(japanese).getByLabelText("本文（Markdown）"), {
      target: { value: "## Preview body\n\n[危険](javascript:alert(1))\n\n<script>alert(1)</script>" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Previewを開く" }));

    const preview = screen.getByRole("heading", { name: "入力内容のPreview" }).closest("section")!;
    expect(within(preview).getByRole("heading", { name: "Preview title" })).toBeInTheDocument();
    expect(within(preview).getByRole("heading", { name: "Preview body" })).toBeInTheDocument();
    expect(within(preview).queryByRole("link", { name: "危険" })).not.toBeInTheDocument();
    expect(within(preview).queryByText("alert(1)")).not.toBeInTheDocument();
  });

  it("未完成ContentをDraft作成し、作成後の編集URLへ移動する", async () => {
    const created = {
      ...content,
      kind: null,
      slug: null,
      category: null,
      translations: {
        ja: { title: "下書き", summary: "", bodyMarkdown: "" },
        en: { title: "", summary: "", bodyMarkdown: "" },
      },
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ content: created }), { status: 201 }));
    render(<AdminContentEditor initialContent={null} databaseConfigured locale="ja" />);
    const japanese = screen.getByRole("group", { name: "日本語" });
    fireEvent.change(within(japanese).getByLabelText("タイトル"), { target: { value: "下書き" } });
    fireEvent.submit(screen.getByRole("button", { name: "下書きを保存" }).closest("form")!);

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/admin/content/${content.id}`));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/content", expect.objectContaining({ method: "POST" }));
    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(payload.translations.ja.title).toBe("下書き");
    expect(payload.kind).toBeNull();
  });

  it("保存処理中は日英の入力を無効化し、応答内容で編集中の値が消えることを防ぐ", async () => {
    let resolveSave: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(<AdminContentEditor initialContent={content} databaseConfigured locale="ja" />);

    fireEvent.submit(screen.getByRole("button", { name: "下書きを保存" }).closest("form")!);

    const japanese = screen.getByRole("group", { name: "日本語" });
    const english = screen.getByRole("group", { name: "English" });
    await waitFor(() => {
      expect(japanese).toBeDisabled();
      expect(english).toBeDisabled();
    });

    resolveSave(new Response(JSON.stringify({ content })));
    expect(await screen.findByRole("status")).toHaveTextContent("下書きを保存しました。");
  });

  it("保存済みDraftを公開し、DBで確定した公開日時を表示する", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const databasePublishedAt = "2026-09-11T02:30:00.000Z";
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          publication: {
            id: content.id,
            status: "published",
            unchanged: false,
            publishedAt: databasePublishedAt,
          },
        }),
      ),
    );
    const { unmount } = render(<AdminContentEditor initialContent={content} databaseConfigured locale="ja" />);

    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Contentを公開しました。");
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/admin/content/${content.id}/publication`,
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "published" }) }),
    );
    const formattedPublishedAt = new Intl.DateTimeFormat("ja", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(databasePublishedAt));
    expect(screen.getByText(`公開日時: ${formattedPublishedAt}`)).toBeInTheDocument();

    unmount();
    render(
      <AdminContentEditor
        initialContent={{ ...content, status: "published", publishedAt: content.updatedAt }}
        databaseConfigured
        locale="ja"
      />,
    );
    expect(screen.getByText(/保存した変更は公開内容へ即時反映されます/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "公開内容を保存" })).toBeInTheDocument();
  });

  it("公開済みContentに未保存変更があっても、入力を保ったままDraftへ戻せる", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          publication: { id: content.id, status: "draft", unchanged: false, publishedAt: null },
        }),
      ),
    );
    render(
      <AdminContentEditor
        initialContent={{ ...content, status: "published", publishedAt: content.updatedAt }}
        databaseConfigured
        locale="ja"
      />,
    );
    const japanese = screen.getByRole("group", { name: "日本語" });
    const title = within(japanese).getByLabelText("タイトル");
    fireEvent.change(title, { target: { value: "編集中のタイトル" } });

    const returnToDraft = screen.getByRole("button", { name: "下書きに戻す" });
    expect(returnToDraft).toBeEnabled();
    fireEvent.click(returnToDraft);

    expect(await screen.findByRole("status")).toHaveTextContent("Contentを下書きに戻しました。");
    expect(title).toHaveValue("編集中のタイトル");
    expect(screen.getByText("下書き", { selector: ".admin-publication-badge" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/admin/content/${content.id}/publication`,
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "draft" }) }),
    );
  });

  it("未保存変更がある間は公開を止め、保存後にAPI Validationをフィールドへ表示する", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errorCode: "validation_error",
          fieldErrors: { slug: "invalid_format", "translations.ja.bodyMarkdown": "invalid_format" },
        }),
        { status: 422 },
      ),
    );
    render(<AdminContentEditor initialContent={content} databaseConfigured locale="ja" />);
    fireEvent.change(screen.getByLabelText("slug"), { target: { value: "INVALID SLUG" } });

    expect(screen.getByRole("button", { name: "公開する" })).toBeDisabled();
    expect(screen.getByText("公開状態を変更する前に、現在の入力を保存してください。")).toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: "下書きを保存" }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("入力内容を確認してください。");
    expect(screen.getByLabelText("slug")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/slugの入力内容を確認してください/)).toBeInTheDocument();
  });

  it("DB未設定時は保存と公開を無効化する", () => {
    render(<AdminContentEditor initialContent={content} databaseConfigured={false} locale="ja" />);
    expect(screen.getByRole("button", { name: "下書きを保存" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "公開する" })).toBeDisabled();
    expect(screen.getByText("データベース未設定のため保存・削除できません。")).toBeInTheDocument();
  });
});
