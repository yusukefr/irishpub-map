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
  prefecture: "東京都",
  city: "渋谷区",
  address: "神南 1-1",
  latitude: 35.1,
  longitude: 139.1,
  websiteUrl: null,
  googleMapsUrl: null,
  instagramUrl: null,
  tags: ["guinness"],
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

  it.each([
    ["ja", "店舗データが正しくありません。"],
    ["en", "The pub data is invalid."],
  ] as const)("translates pub validation errors for %s", async (locale, expected) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ errorCode: "invalid_pub_data" }), { status: 400 }));
    render(
      <AdminPubManager {...managerProps} initialPage={{ pubs: [], total: 0, page: 1, pageSize: 50 }} locale={locale} />,
    );
    fireEvent.submit(screen.getByRole("button", { name: locale === "ja" ? "追加" : "Add" }).closest("form")!);
    expect(await screen.findByRole("status")).toHaveTextContent(expected);
  });

  it("adds, edits, and deletes pubs", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ pub: { ...pub, id: "pub-2", name: "New Pub" } })));
    render(<AdminPubManager {...managerProps} />);
    fireEvent.change(screen.getAllByLabelText("店舗名")[0], { target: { value: "New Pub" } });
    fireEvent.change(screen.getAllByLabelText("都道府県")[0], { target: { value: "大阪府" } });
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
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    await waitFor(() => expect(screen.queryByText("Updated")).not.toBeInTheDocument());
  });

  it("resets municipality options when the prefecture changes", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ municipalities: [{ code: "271004", prefectureCode: 27, name: "大阪市北区" }] })),
    );
    render(
      <AdminPubManager {...managerProps} condition={{ prefectureCode: 13, municipalityCode: "131130", page: 1 }} />,
    );

    fireEvent.change(screen.getAllByLabelText("都道府県")[1], { target: { value: "27" } });
    await waitFor(() => expect(screen.getByRole("option", { name: "大阪市北区" })).toBeInTheDocument());
    expect(screen.getAllByLabelText("市区町村")[1]).toHaveValue("");
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
    expect(await screen.findByRole("status")).toHaveTextContent(
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
});
