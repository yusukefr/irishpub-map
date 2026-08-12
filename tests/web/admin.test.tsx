// 管理画面の認証と店舗CRUDの利用者操作をAPIモック越しに保証するテストです。
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "../../apps/web/app/components/admin-login-form";
import { AdminPubManager } from "../../apps/web/app/components/admin-pub-manager";

const push = vi.fn();
const fetchMock = vi.fn();
// 画面遷移を発生させず、認証後の遷移先だけを観測します。
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const pub = { id: "pub-1", name: "The Pub", prefecture: "東京都", city: "渋谷区", address: "神南 1-1", latitude: 35.1, longitude: 139.1, websiteUrl: null, googleMapsUrl: null, instagramUrl: null, tags: ["guinness"], status: "open" as const };

beforeEach(() => {
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("admin UI", () => {
  it("logs in and displays an API error", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "失敗" }), { status: 401 }));
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "password" } });
    fireEvent.submit(screen.getByRole("button", { name: "ログイン" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("失敗");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    fireEvent.submit(screen.getByRole("button", { name: "ログイン" }).closest("form")!);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
  });

  it("adds, edits, deletes pubs and logs out", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ pub: { ...pub, id: "pub-2", name: "New Pub" } })));
    render(<AdminPubManager initialPubs={[pub]} databaseConfigured />);
    fireEvent.change(screen.getByLabelText("店舗名"), { target: { value: "New Pub" } });
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "大阪府" } });
    fireEvent.change(screen.getByLabelText("住所"), { target: { value: "大阪市 1-1" } });
    fireEvent.change(screen.getByLabelText("緯度"), { target: { value: "34.1" } });
    fireEvent.change(screen.getByLabelText("経度"), { target: { value: "135.1" } });
    fireEvent.submit(screen.getByRole("button", { name: "追加" }).closest("form")!);
    expect(await screen.findByText("保存しました。")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "編集" })[0]);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ pub: { ...pub, name: "Updated" } })));
    fireEvent.submit(screen.getByRole("button", { name: "更新" }).closest("form")!);
    expect(await screen.findByText("Updated")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    fireEvent.click(screen.getAllByRole("button", { name: "削除" })[1]);
    await waitFor(() => expect(screen.queryByText("Updated")).not.toBeInTheDocument());

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/login"));
  });
});
