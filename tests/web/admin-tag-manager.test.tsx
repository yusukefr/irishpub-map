// タグ管理画面の一覧、登録、翻訳編集、使用中削除拒否、確認、処理状態をAPIモック越しに保証します。
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminTagManager } from "../../apps/web/app/components/admin-tag-manager";

const fetchMock = vi.fn();
const tags = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    key: "food",
    nameJa: "食事あり",
    nameEn: "Food",
    pubCount: 3,
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    key: "whiskey",
    nameJa: "ウイスキー",
    nameEn: null,
    pubCount: 0,
  },
];

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.restoreAllMocks();
});

describe("AdminTagManager", () => {
  it("shows translations and pub counts while disabling deletion for an in-use tag", () => {
    render(<AdminTagManager initialTags={tags} databaseConfigured locale="ja" />);

    expect(screen.getByRole("heading", { name: "登録タグ（2件）" })).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("未登録")).toBeInTheDocument();
    const deleteButtons = screen.getAllByRole("button", { name: "削除" });
    expect(deleteButtons[0]).toBeDisabled();
    expect(deleteButtons[0]).toHaveAttribute("title", "店舗で使用中のタグは削除できません。");
    expect(deleteButtons[1]).toBeEnabled();
  });

  it("creates a tag once and shows the saved result", async () => {
    const created = {
      ...tags[1],
      id: "550e8400-e29b-41d4-a716-446655440003",
      key: "craft-beer",
      nameJa: "クラフトビール",
      nameEn: "Craft Beer",
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ tag: created }), { status: 201 }));
    render(<AdminTagManager initialTags={[]} databaseConfigured locale="ja" />);

    fireEvent.change(screen.getByLabelText("key"), { target: { value: "craft-beer" } });
    fireEvent.change(screen.getByLabelText("日本語"), { target: { value: "クラフトビール" } });
    fireEvent.change(screen.getByLabelText("English（任意）"), { target: { value: "Craft Beer" } });
    fireEvent.submit(screen.getByRole("button", { name: "追加" }).closest("form")!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "craft-beer", nameJa: "クラフトビール", nameEn: "Craft Beer" }),
    });
    expect(await screen.findByRole("status")).toHaveTextContent("タグを保存しました。");
    expect(screen.getByText("Craft Beer")).toBeInTheDocument();
  });

  it("keeps key read-only while editing and allows adding the English translation", async () => {
    const updated = { ...tags[1], nameJa: "ウィスキー", nameEn: "Whiskey" };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ tag: updated })));
    render(<AdminTagManager initialTags={[tags[1]]} databaseConfigured locale="ja" />);

    fireEvent.click(screen.getByRole("button", { name: "編集" }));
    expect(screen.getByLabelText("key")).toHaveAttribute("readonly");
    fireEvent.change(screen.getByLabelText("日本語"), { target: { value: "ウィスキー" } });
    fireEvent.change(screen.getByLabelText("English（任意）"), { target: { value: "Whiskey" } });
    fireEvent.submit(screen.getByRole("button", { name: "更新" }).closest("form")!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith(`/api/admin/tags/${tags[1].id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameJa: "ウィスキー", nameEn: "Whiskey" }),
    });
    expect(await screen.findByText("ウィスキー")).toBeInTheDocument();
    expect(screen.getByText("Whiskey")).toBeInTheDocument();
  });

  it("confirms and deletes an unused tag without deleting an in-use tag", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    render(<AdminTagManager initialTags={tags} databaseConfigured locale="ja" />);

    fireEvent.click(screen.getAllByRole("button", { name: "削除" })[1]);

    expect(confirm).toHaveBeenCalledWith("「ウイスキー」を削除しますか？ この操作は元に戻せません。");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/admin/tags/${tags[1].id}`, { method: "DELETE" }));
    expect(await screen.findByRole("status")).toHaveTextContent("タグを削除しました。");
    expect(screen.queryByText("ウイスキー")).not.toBeInTheDocument();
    expect(screen.getByText("食事あり")).toBeInTheDocument();
  });

  it("shows field errors and prevents duplicate submission while saving", async () => {
    let resolveResponse!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (resolveResponse = resolve)));
    render(<AdminTagManager initialTags={[]} databaseConfigured locale="ja" />);

    fireEvent.change(screen.getByLabelText("key"), { target: { value: "food" } });
    fireEvent.change(screen.getByLabelText("日本語"), { target: { value: "食事あり" } });
    const form = screen.getByRole("button", { name: "追加" }).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole("button", { name: "保存中…" })).toBeDisabled());
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledOnce();

    resolveResponse(
      new Response(
        JSON.stringify({ error: "入力内容を確認してください。", fieldErrors: { key: "keyは重複しています。" } }),
        { status: 422 },
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("keyは重複しています。");
  });

  it("disables all mutation controls when the database is not configured", () => {
    render(<AdminTagManager initialTags={tags} databaseConfigured={false} locale="ja" />);

    expect(screen.getByText("DATABASE_URL が未設定です。閲覧のみ可能です。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "追加" })).toBeDisabled();
    for (const button of screen.getAllByRole("button", { name: "編集" })) expect(button).toBeDisabled();
  });
});
