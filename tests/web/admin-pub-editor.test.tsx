import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPubEditor } from "../../apps/web/app/components/admin-pub-editor";

const push = vi.fn();
const refresh = vi.fn();
const fetchMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.stubGlobal("fetch", fetchMock);

const tags = [{ id: "550e8400-e29b-41d4-a716-446655440010", key: "guinness", name: "ギネス" }];
const props = {
  initialPub: null,
  prefectures: [{ code: 13, name: "東京都" }],
  municipalities: [],
  statuses: [{ code: 1, key: "open" as const, name: "営業中" }],
  tags,
  databaseConfigured: true,
  locale: "ja" as const,
};
const existingPub = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  isPublished: false,
  prefectureCode: 13,
  municipalityCode: "131130",
  latitude: 35.1,
  longitude: 139.1,
  websiteUrl: "https://example.com",
  googleMapsUrl: null,
  instagramUrl: null,
  status: "open" as const,
  translations: {
    ja: { name: "The Pub", nameReading: "ザ パブ", address: "渋谷" },
    en: { name: "The Pub", nameReading: null, address: "Shibuya" },
  },
  tagIds: [tags[0].id],
  updatedAt: "2026-08-30T00:00:00.000Z",
};

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  fetchMock.mockReset();
  vi.restoreAllMocks();
});

describe("AdminPubEditor", () => {
  it("保存時に日本語のみの下書きとタグ0件を送信する", async () => {
    const created = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      isPublished: false,
      prefectureCode: null,
      municipalityCode: null,
      latitude: null,
      longitude: null,
      websiteUrl: null,
      googleMapsUrl: null,
      instagramUrl: null,
      status: null,
      translations: { ja: { name: "Draft", nameReading: null, address: null }, en: null },
      tagIds: [],
      updatedAt: "2026-08-30T00:00:00.000Z",
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ pub: created }), { status: 201 }));
    render(<AdminPubEditor {...props} />);
    fireEvent.change(screen.getByLabelText("店舗名"), { target: { value: "Draft" } });
    fireEvent.submit(screen.getByRole("button", { name: "追加" }).closest("form")!);
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/pubs/${created.id}/edit`));
    const payload = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(payload.translations.en).toBeNull();
    expect(payload.tagIds).toEqual([]);
  });

  it("都道府県変更で市区町村をリセットし、タグ検索を絞り込む", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ municipalities: [{ code: "131130", prefectureCode: 13, name: "渋谷区" }] })),
    );
    render(<AdminPubEditor {...props} />);
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "13" } });
    expect(await screen.findByRole("option", { name: "渋谷区" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("市区町村"), { target: { value: "131130" } });
    fireEvent.change(screen.getByLabelText("タグを検索"), { target: { value: "unknown" } });
    expect(screen.queryByLabelText("ギネス")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "" } });
    expect(screen.getByLabelText("市区町村")).toBeDisabled();
    expect(screen.getByLabelText("市区町村")).toHaveValue("");
  });

  it("既存店舗の英語・タグを更新し、公開と削除を実行する", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            pub: {
              ...existingPub,
              translations: {
                ...existingPub.translations,
                ja: { ...existingPub.translations.ja, name: "The Updated Pub" },
              },
            },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ publication: { id: existingPub.id } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    render(
      <AdminPubEditor
        {...props}
        initialPub={existingPub}
        municipalities={[{ code: "131130", prefectureCode: 13, name: "渋谷区" }]}
        returnTo="/admin/pubs?published=false&page=2"
      />,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "The Updated Pub" } });
    fireEvent.change(screen.getByLabelText("営業状況"), { target: { value: "open" } });
    fireEvent.change(screen.getByLabelText("緯度"), { target: { value: "35.2" } });
    fireEvent.change(screen.getByLabelText("経度"), { target: { value: "139.2" } });
    fireEvent.change(screen.getByLabelText("市区町村を検索"), { target: { value: "渋谷" } });
    fireEvent.change(screen.getByLabelText("店舗名読み"), { target: { value: "更新読み" } });
    fireEvent.change(screen.getByLabelText("住所"), { target: { value: "更新住所" } });
    fireEvent.change(screen.getByLabelText("公式サイト"), { target: { value: "https://updated.example.com" } });
    fireEvent.change(screen.getByLabelText("Google Maps"), { target: { value: "https://maps.example.com" } });
    fireEvent.change(screen.getByLabelText("Instagram"), { target: { value: "https://instagram.com/example" } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "Updated address" } });
    fireEvent.click(screen.getByLabelText("英語情報を登録する"));
    fireEvent.click(screen.getByLabelText("ギネス"));
    fireEvent.submit(screen.getByRole("button", { name: "更新" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("店舗情報を更新しました。"));
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("「The Updated Pub」を公開しました。"));
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/pubs?published=false&page=2"));
  });

  it("Validationエラーと公開不足項目を表示し、保存中は再送信を抑止する", async () => {
    let resolveSave!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (resolveSave = resolve)));
    render(<AdminPubEditor {...props} />);
    fireEvent.change(screen.getByLabelText("店舗名"), { target: { value: "Draft" } });
    const form = screen.getByRole("button", { name: "追加" }).closest("form")!;
    fireEvent.submit(form);
    expect(screen.getByRole("button", { name: "保存中…" })).toBeDisabled();
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveSave(
      new Response(JSON.stringify({ errorCode: "validation_error", fieldErrors: { name: "required" } }), {
        status: 422,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("入力内容を確認してください。");
    expect(screen.getByLabelText("店舗名")).toHaveAttribute("aria-invalid", "true");
  });

  it("DB未設定時は書き込み操作を無効化する", () => {
    render(<AdminPubEditor {...props} databaseConfigured={false} />);
    expect(screen.getByRole("button", { name: "追加" })).toBeDisabled();
    expect(screen.getByText("データベース未設定のため保存・削除できません。")).toBeInTheDocument();
  });

  it("公開・削除APIの失敗と通信エラーを利用者へ通知する async", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errorCode: "publication_requirements_not_met", missingFields: ["address"] }), {
          status: 422,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ errorCode: "internal_error" }), { status: 500 }));
    render(<AdminPubEditor {...props} initialPub={existingPub} />);
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("この店舗は公開条件を満たしていません。");
    expect(screen.getByText("不足している項目: 日本語住所")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("処理中にエラーが発生しました。");
  });

  it("市区町村マスタ取得の通信エラーを表示する", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    render(<AdminPubEditor {...props} />);
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "13" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("処理中にエラーが発生しました。");
  });

  it("公開済み店舗を非公開へ切り替えられる", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ publication: { id: existingPub.id } })));
    render(<AdminPubEditor {...props} initialPub={{ ...existingPub, isPublished: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "非公開にする" }));
    expect(await screen.findByRole("status")).toHaveTextContent("「The Pub」を非公開にしました。");
  });

  it("公開確認をキャンセルするとAPIを呼び出さない", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AdminPubEditor {...props} initialPub={existingPub} />);
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("保存中は公開と削除も無効化する", () => {
    let resolveSave!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (resolveSave = resolve)));
    render(<AdminPubEditor {...props} initialPub={existingPub} />);
    fireEvent.submit(screen.getByRole("button", { name: "更新" }).closest("form")!);
    expect(screen.getByRole("button", { name: "公開する" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "削除" })).toBeDisabled();
    resolveSave(new Response(JSON.stringify({ pub: existingPub })));
  });

  it("英語情報を有効にすると英語住所を必須にする", () => {
    render(<AdminPubEditor {...props} />);
    fireEvent.click(screen.getByLabelText("英語情報を登録する"));
    expect(screen.getByLabelText("Address")).toBeRequired();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "The Pub" } });
    expect(screen.getByRole("button", { name: "追加" }).closest("form")).not.toBeNull();
    expect(screen.getByLabelText("Address")).toBeInvalid();
  });
  it("英語NameのAPIバリデーションエラーを入力欄へ関連付ける", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ errorCode: "validation_error", fieldErrors: { "translations.en.name": "required" } }),
        {
          status: 422,
        },
      ),
    );
    render(<AdminPubEditor {...props} />);
    fireEvent.change(screen.getByLabelText("店舗名"), { target: { value: "店舗" } });
    fireEvent.click(screen.getByLabelText("英語情報を登録する"));
    const englishName = screen.getByLabelText("Name");
    fireEvent.change(englishName, { target: { value: " " } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "Address" } });
    fireEvent.submit(screen.getByRole("button", { name: "追加" }).closest("form")!);
    await waitFor(() => expect(englishName).toHaveAttribute("aria-invalid", "true"));
    expect(englishName).toHaveAttribute("aria-describedby", "admin-pub-english-name-error");
    expect(screen.getByText("入力内容を確認してください。", { selector: ".admin-field-error" })).toBeInTheDocument();
  });
  it("未保存変更がある状態で一覧へ移動すると確認する", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AdminPubEditor {...props} initialPub={existingPub} />);
    fireEvent.change(screen.getByLabelText("店舗名"), { target: { value: "変更中" } });
    fireEvent.click(screen.getByRole("link", { name: "キャンセル" }));
    expect(confirm).toHaveBeenCalledWith("保存されていない変更があります。このページから移動しますか？");
  });
  it("内部リンク遷移を許可した直後はbeforeunloadを二重表示しない", () => {
    vi.useFakeTimers();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<AdminPubEditor {...props} initialPub={existingPub} />);
    fireEvent.change(screen.getByLabelText("店舗名"), { target: { value: "変更中" } });
    const cancelLink = screen.getByRole("link", { name: "キャンセル" });
    cancelLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(cancelLink);

    const navigationEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(navigationEvent);
    expect(navigationEvent.defaultPrevented).toBe(false);

    vi.runAllTimers();
    const laterEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(laterEvent);
    expect(laterEvent.defaultPrevented).toBe(true);
    vi.useRealTimers();
  });
});
