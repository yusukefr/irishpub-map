// 管理画面の認証と店舗CRUDの利用者操作をAPIモック越しに保証するテストです。
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "../../apps/web/app/components/admin-login-form";
import { AdminPubManager } from "../../apps/web/app/components/admin-pub-manager";
import { parseAdminPubWriteInput } from "../../packages/shared/src/admin-pub";

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

const pubDetail = {
  id: pub.id,
  isPublished: false,
  prefectureCode: 13,
  municipalityCode: "131130",
  latitude: 35.1,
  longitude: 139.1,
  websiteUrl: null,
  googleMapsUrl: null,
  instagramUrl: null,
  status: "open" as const,
  translations: {
    ja: { name: "The Pub", nameReading: "ザ パブ", address: "神南 1-1" },
    en: { name: "The Pub", nameReading: null, address: "1-1 Jinnan" },
  },
  tagIds: ["550e8400-e29b-41d4-a716-446655440010"],
  updatedAt: pub.updatedAt,
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

  it("saves a name-only draft with explicit null values", async () => {
    const draft = {
      ...pubDetail,
      prefectureCode: null,
      municipalityCode: null,
      latitude: null,
      longitude: null,
      status: null,
      translations: { ja: { name: "Draft Pub", nameReading: null, address: null }, en: null },
      tagIds: [],
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ pub: draft })));
    render(<AdminPubManager {...managerProps} initialPage={{ pubs: [], total: 0, page: 1, pageSize: 50 }} />);

    fireEvent.change(screen.getAllByLabelText("店舗名")[0], { target: { value: "Draft Pub" } });
    fireEvent.submit(screen.getByRole("button", { name: "追加" }).closest("form")!);
    expect(await screen.findByText("保存しました。")).toBeInTheDocument();

    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(parseAdminPubWriteInput(payload)).toEqual({
      prefectureCode: null,
      municipalityCode: null,
      latitude: null,
      longitude: null,
      websiteUrl: null,
      googleMapsUrl: null,
      instagramUrl: null,
      status: null,
      translations: { ja: { name: "Draft Pub", nameReading: null, address: null }, en: null },
      tagIds: [],
    });
  });

  it("sends parser-compatible payloads while adding, editing, and deleting pubs", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ municipalities: [{ code: "271004", prefectureCode: 27, name: "大阪市北区" }] })),
    );
    render(<AdminPubManager {...managerProps} />);
    fireEvent.change(screen.getAllByLabelText("店舗名")[0], { target: { value: "New Pub" } });
    fireEvent.change(screen.getAllByLabelText("都道府県")[0], { target: { value: "27" } });
    expect(await screen.findByRole("option", { name: "大阪市北区" })).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText("市区町村")[0], { target: { value: "271004" } });
    fireEvent.change(screen.getByLabelText("住所"), { target: { value: "大阪市 1-1" } });
    fireEvent.change(screen.getByLabelText("緯度"), { target: { value: "34.1" } });
    fireEvent.change(screen.getByLabelText("経度"), { target: { value: "135.1" } });
    const tagSelect = screen.getByLabelText("タグ（複数選択可）") as HTMLSelectElement;
    tagSelect.options[0].selected = true;
    fireEvent.change(screen.getAllByLabelText("営業状況")[0], { target: { value: "open" } });

    const createdPub = {
      ...pubDetail,
      id: "550e8400-e29b-41d4-a716-446655440002",
      prefectureCode: 27,
      municipalityCode: "271004",
      latitude: 34.1,
      longitude: 135.1,
      translations: { ja: { name: "New Pub", nameReading: null, address: "大阪市 1-1" }, en: null },
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ pub: createdPub })));
    fireEvent.submit(screen.getByRole("button", { name: "追加" }).closest("form")!);
    expect(await screen.findByText("保存しました。")).toBeInTheDocument();

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) => url === "/api/admin/pubs" && (init as RequestInit).method === "POST",
    );
    expect(createCall).toBeDefined();
    expect(parseAdminPubWriteInput(JSON.parse(String((createCall![1] as RequestInit).body)))).toEqual({
      prefectureCode: 27,
      municipalityCode: "271004",
      latitude: 34.1,
      longitude: 135.1,
      websiteUrl: null,
      googleMapsUrl: null,
      instagramUrl: null,
      status: "open",
      translations: { ja: { name: "New Pub", nameReading: null, address: "大阪市 1-1" }, en: null },
      tagIds: [managerProps.tags[0].id],
    });

    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ pub: pubDetail })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ municipalities: managerProps.municipalities })));
    fireEvent.click(screen.getAllByRole("button", { name: "編集" })[0]);
    const updateButton = await screen.findByRole("button", { name: "更新" });
    fireEvent.change(screen.getAllByLabelText("店舗名")[0], { target: { value: "Updated" } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pub: {
            ...pubDetail,
            translations: { ...pubDetail.translations, ja: { ...pubDetail.translations.ja, name: "Updated" } },
          },
        }),
      ),
    );
    fireEvent.submit(updateButton.closest("form")!);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) => url === `/api/admin/pubs/${pub.id}` && (init as RequestInit | undefined)?.method === "PUT",
        ),
      ).toBe(true),
    );
    const updateCall = fetchMock.mock.calls.find(
      ([url, init]) => url === `/api/admin/pubs/${pub.id}` && (init as RequestInit | undefined)?.method === "PUT",
    )!;
    expect(parseAdminPubWriteInput(JSON.parse(String((updateCall[1] as RequestInit).body))).translations).toEqual({
      ja: { name: "Updated", nameReading: "ザ パブ", address: "神南 1-1" },
      en: pubDetail.translations.en,
    });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    await waitFor(() => expect(screen.queryByText("The Pub")).not.toBeInTheDocument());
  });

  it("clears the form municipality and reports master lookup failures", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    render(<AdminPubManager {...managerProps} />);

    const formPrefecture = screen.getAllByLabelText("都道府県")[0];
    fireEvent.change(formPrefecture, { target: { value: "27" } });
    expect(await screen.findByRole("status")).toHaveTextContent("処理中にエラーが発生しました。");

    fireEvent.change(formPrefecture, { target: { value: "" } });
    expect(screen.getAllByLabelText("市区町村")[0]).toBeDisabled();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ errorCode: "database_unavailable" }), { status: 503 }),
    );
    fireEvent.change(formPrefecture, { target: { value: "13" } });
    expect(await screen.findByRole("status")).toHaveTextContent("データベースを利用できません。");
  });

  it("edits a location-less draft and reports edit and publication network failures", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          pub: { ...pubDetail, prefectureCode: null, municipalityCode: null, status: null },
        }),
      ),
    );
    render(<AdminPubManager {...managerProps} />);

    fireEvent.click(screen.getAllByRole("button", { name: "編集" })[0]);
    expect(await screen.findByRole("button", { name: "更新" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("都道府県")[0]).toHaveValue("");
    expect(screen.getAllByLabelText("市区町村")[0]).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    fetchMock.mockRejectedValueOnce(new Error("network"));
    fireEvent.click(screen.getAllByRole("button", { name: "編集" })[0]);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status")).toHaveTextContent("処理中にエラーが発生しました。");

    fetchMock.mockRejectedValueOnce(new Error("network"));
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("status")).toHaveTextContent("処理中にエラーが発生しました。");
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
    const searchMunicipality = screen.getAllByLabelText("市区町村")[1];
    expect(searchMunicipality).toHaveValue("");
    fireEvent.change(searchMunicipality, { target: { value: "271004" } });
  });

  it("ignores an older municipality response after another prefecture is selected", async () => {
    let resolveAichi!: (response: Response) => void;
    let resolveMie!: (response: Response) => void;
    fetchMock
      .mockReturnValueOnce(new Promise<Response>((resolve) => (resolveAichi = resolve)))
      .mockReturnValueOnce(new Promise<Response>((resolve) => (resolveMie = resolve)));
    render(
      <AdminPubManager
        {...managerProps}
        locale="en"
        condition={{ page: 1 }}
        prefectures={[
          { code: 23, name: "Aichi" },
          { code: 24, name: "Mie" },
        ]}
        municipalities={[]}
      />,
    );

    const prefecture = screen.getAllByLabelText("Prefecture")[1];
    fireEvent.change(prefecture, { target: { value: "23" } });
    fireEvent.change(prefecture, { target: { value: "24" } });
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toMatchObject({ aborted: true });

    await act(async () => {
      resolveMie(
        new Response(JSON.stringify({ municipalities: [{ code: "242012", prefectureCode: 24, name: "Tsu" }] })),
      );
    });
    expect(await screen.findByRole("option", { name: "Tsu" })).toBeInTheDocument();

    await act(async () => {
      resolveAichi(
        new Response(JSON.stringify({ municipalities: [{ code: "231002", prefectureCode: 23, name: "Nagoya" }] })),
      );
    });
    expect(screen.queryByRole("option", { name: "Nagoya" })).not.toBeInTheDocument();
    expect(screen.getAllByLabelText("Municipality")[0]).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Pub list pagination" })).toBeInTheDocument();
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
