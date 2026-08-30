// 管理画面の認証と店舗CRUDの利用者操作をAPIモック越しに保証するテストです。
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "../../apps/web/app/components/admin-login-form";
import { AdminPubManager } from "../../apps/web/app/components/admin-pub-manager";

const push = vi.fn();
const refresh = vi.fn();
const fetchMock = vi.fn();
// 画面遷移を発生させず、認証後の遷移先だけを観測します。
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const pub = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "The Pub",
  kana: "ザ パブ",
  prefecture: "東京都",
  city: "渋谷区",
  municipalityCode: "131130",
  address: "神南 1-1",
  latitude: 35.1,
  longitude: 139.1,
  websiteUrl: null,
  googleMapsUrl: null,
  instagramUrl: null,
  tags: ["guinness"],
  tagDisplayNames: { guinness: "ギネス" },
  status: "open" as const,
  statusDisplayName: "営業中",
  prefectureCode: 13,
  statusCode: 1,
  tagItems: [{ id: "550e8400-e29b-41d4-a716-446655440010", key: "guinness", name: "ギネス" }],
  isPublished: false,
  updatedAt: "2026-08-29T01:00:00.000Z",
};

const managerProps = {
  initialPage: { pubs: [pub], total: 1, page: 1, pageSize: 50 },
  condition: { page: 1 },
  prefectures: [
    { code: 13, name: "東京都" },
    { code: 27, name: "大阪府" },
  ],
  municipalities: [{ code: "131130", prefectureCode: 13, name: "渋谷区" }],
  statuses: [{ code: 1, key: "open", name: "営業中" }],
  tags: [{ id: "550e8400-e29b-41d4-a716-446655440010", key: "guinness", name: "ギネス" }],
  databaseConfigured: true,
  locale: "ja" as const,
};

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("admin UI", () => {
  it("logs in and translates an API error into Japanese", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ errorCode: "invalid_credentials" }), { status: 401 }),
    );
    render(<LoginForm locale="ja" />);
    fireEvent.change(screen.getByLabelText("ID"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("パスワード"), { target: { value: "password" } });
    fireEvent.submit(screen.getByRole("button", { name: "ログイン" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("ID またはパスワードが正しくありません。");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    fireEvent.submit(screen.getByRole("button", { name: "ログイン" }).closest("form")!);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
  });

  it("translates login errors into English and safely handles unknown responses", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ errorCode: "invalid_credentials" }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "database connection detail" }), { status: 500 }));
    render(<LoginForm locale="en" />);
    const form = screen.getByRole("button", { name: "Sign in" }).closest("form")!;
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("The ID or password is incorrect.");
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("An unexpected error occurred.");
  });

  it("does not invert the item range if an out-of-range page reaches the client", () => {
    render(
      <AdminPubManager
        {...managerProps}
        initialPage={{ pubs: [], total: 30, page: 2, pageSize: 50 }}
        condition={{ page: 2 }}
      />,
    );

    expect(screen.getByText("0〜0 / 30件")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "前へ" })).toHaveAttribute("href", "/admin/pubs");
  });

  it("編集リンクへ一覧の検索条件を引き継ぐ", () => {
    const condition = {
      name: "Irish",
      prefectureCode: 23,
      municipalityCode: "231002",
      statusKey: "open" as const,
      tagId: "550e8400-e29b-41d4-a716-446655440010",
      isPublished: false,
      page: 2,
    };
    render(
      <AdminPubManager
        {...managerProps}
        condition={condition}
        initialPage={{ ...managerProps.initialPage, page: 2 }}
      />,
    );
    const href = screen.getByRole("link", { name: "編集" }).getAttribute("href");
    expect(href).toBeTruthy();
    expect(new URLSearchParams(href!.split("?")[1]).get("returnTo")).toBe(
      "/admin/pubs?name=Irish&prefecture=23&municipality=231002&status=open&tag=550e8400-e29b-41d4-a716-446655440010&published=false&page=2",
    );
  });
  it("publishes a pub after confirmation and shows the result immediately", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ publication: { id: pub.id, isPublished: true, unchanged: false } })),
    );
    render(<AdminPubManager {...managerProps} />);

    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    expect(await screen.findByText("「The Pub」を公開しました。")).toBeInTheDocument();
    expect(screen.getByText("公開", { selector: ".admin-publication-badge" })).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows all missing publication fields returned by the server", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errorCode: "publication_requirements_not_met",
          missingFields: ["address", "latitude"],
        }),
        { status: 422 },
      ),
    );
    render(<AdminPubManager {...managerProps} />);

    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "この店舗は公開条件を満たしていません。 不足している項目: 日本語住所, 緯度",
    );
    expect(screen.getByText("非公開", { selector: ".admin-publication-badge" })).toBeInTheDocument();
  });

  it("disables the publication action while the request is pending", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let resolveRequest!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (resolveRequest = resolve)));
    render(<AdminPubManager {...managerProps} />);

    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    const pendingButton = await screen.findByRole("button", { name: "公開中…" });
    expect(pendingButton).toBeDisabled();

    resolveRequest(new Response(JSON.stringify({ publication: { id: pub.id, isPublished: true, unchanged: false } })));
    await waitFor(() => expect(screen.getByRole("button", { name: "非公開にする" })).toBeEnabled());
  });
  it("loads municipalities for the search filter and clears them when prefecture is reset", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ municipalities: [{ code: "271004", prefectureCode: 27, name: "大阪市北区" }] })),
    );
    render(<AdminPubManager {...managerProps} />);
    const prefecture = screen.getByLabelText("都道府県");
    fireEvent.change(prefecture, { target: { value: "27" } });
    expect(await screen.findByRole("option", { name: "大阪市北区" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("市区町村"), { target: { value: "271004" } });
    fireEvent.change(prefecture, { target: { value: "" } });
    expect(screen.getByLabelText("市区町村")).toBeDisabled();
    expect(screen.getByLabelText("市区町村")).toHaveValue("");
  });

  it("keeps a visible danger style hook for unpublishing a published pub", () => {
    render(
      <AdminPubManager
        {...managerProps}
        initialPage={{ ...managerProps.initialPage, pubs: [{ ...pub, isPublished: true }] }}
      />,
    );

    expect(screen.getByRole("button", { name: "非公開にする" })).toHaveClass("admin-danger-action");
  });

  it("reports search municipality lookup failures and ignores a cancelled response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ errorCode: "database_unavailable" }), { status: 503 }),
    );
    render(<AdminPubManager {...managerProps} />);
    const prefecture = screen.getByLabelText("都道府県");
    fireEvent.change(prefecture, { target: { value: "27" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("データベースを利用できません。");

    let resolveFirst!: (response: Response) => void;
    let resolveSecond!: (response: Response) => void;
    fetchMock
      .mockReturnValueOnce(new Promise<Response>((resolve) => (resolveFirst = resolve)))
      .mockReturnValueOnce(new Promise<Response>((resolve) => (resolveSecond = resolve)));
    fireEvent.change(prefecture, { target: { value: "13" } });
    fireEvent.change(prefecture, { target: { value: "27" } });
    expect((fetchMock.mock.calls[1][1] as RequestInit).signal).toMatchObject({ aborted: true });
    resolveSecond(
      new Response(JSON.stringify({ municipalities: [{ code: "271004", prefectureCode: 27, name: "大阪市北区" }] })),
    );
    expect(await screen.findByRole("option", { name: "大阪市北区" })).toBeInTheDocument();
    resolveFirst(
      new Response(JSON.stringify({ municipalities: [{ code: "131130", prefectureCode: 13, name: "渋谷区" }] })),
    );
    await waitFor(() => expect(screen.queryByRole("option", { name: "渋谷区" })).not.toBeInTheDocument());
  });

  it("does not call publication API when confirmation is cancelled or the database is unavailable", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AdminPubManager {...managerProps} databaseConfigured={false} />);
    const publishButton = screen.getByRole("button", { name: "公開する" });
    expect(publishButton).toBeDisabled();
    fireEvent.click(publishButton);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
