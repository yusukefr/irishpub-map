// 検索・絞り込み・位置情報・カードとピンの共有状態を保証する結合テストです。
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PubExplorer } from "../../apps/web/app/components/pub-explorer";
import type { Pub } from "../../packages/shared/src/pub";
import { maplibreMock, resetMaplibreMock } from "../mocks/maplibre-gl";

const pubs: Pub[] = [
  {
    id: "tokyo-sample",
    name: "Tokyo Sample Pub",
    prefecture: "東京都",
    city: "千代田区",
    municipalityCode: "131016",
    address: "東京都千代田区1-1-1",
    latitude: 35.681,
    longitude: 139.767,
    websiteUrl: "https://example.com",
    googleMapsUrl: "https://maps.example.com",
    instagramUrl: null,
    tags: ["guinness", "food"],
    status: "open",
  },
  {
    id: "osaka-sample",
    name: "Osaka Sample Pub",
    prefecture: "大阪府",
    city: "大阪市",
    municipalityCode: "271004",
    address: "大阪府大阪市1-1-1",
    latitude: 34.693,
    longitude: 135.502,
    websiteUrl: null,
    googleMapsUrl: null,
    instagramUrl: null,
    tags: ["live-music"],
    status: "unknown",
  },
  {
    id: "kyoto-sample",
    name: "Kyoto Sample Pub",
    prefecture: "京都府",
    municipalityCode: "261009",
    address: "京都府京都市1-1-1",
    latitude: 35.011,
    longitude: 135.768,
    websiteUrl: null,
    googleMapsUrl: null,
    instagramUrl: null,
    tags: ["food"],
    status: "closed",
  },
];

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalGeolocation = navigator.geolocation;

/** JSDOMにWebGL利用可能なブラウザ環境を再現します。 */
function mockWebglContext() {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId: string) => {
    if (contextId === "webgl" || contextId === "experimental-webgl") {
      return {} as never;
    }

    return null;
  });
}

/** テストごとに位置情報APIの成功・失敗条件を差し替えます。 */
function mockGeolocation(geolocation: Partial<Geolocation> | undefined) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: geolocation,
  });
}

/** 初期状態で折りたたまれている詳細条件を開きます。 */
function openDetailedFilters() {
  fireEvent.click(screen.getByRole("button", { name: "条件を指定" }));
}

describe("PubExplorer", () => {
  beforeEach(() => {
    resetMaplibreMock();
    mockWebglContext();
    mockGeolocation(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    mockGeolocation(originalGeolocation);
  });

  it("shows a search placeholder without prefecture", () => {
    render(<PubExplorer pubs={pubs} />);

    expect(screen.getByLabelText("店舗を検索")).toHaveAttribute("placeholder", "店舗名、エリア");
  });

  it("keeps detailed filters out of the primary flow and exposes their state", () => {
    render(<PubExplorer pubs={pubs} />);

    const toggle = screen.getByRole("button", { name: "条件を指定" });
    const filterDetails = document.getElementById("pub-filter-options");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "pub-filter-options");
    expect(screen.queryByRole("region", { name: "地図と条件から探す" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "都道府県" })).not.toBeInTheDocument();

    openDetailedFilters();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("pub-filter-options")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "東京都" } });
    expect(screen.getByLabelText("詳細条件1件を適用中")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "条件パネルを閉じる" }));
    expect(screen.queryByRole("region", { name: "地図と条件から探す" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "都道府県" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("詳細条件1件を適用中")).toBeInTheDocument();
  });

  it("closes the filter panel with Escape and returns focus to its trigger", () => {
    render(<PubExplorer pubs={pubs} />);

    const toggle = screen.getByRole("button", { name: "条件を指定" });
    fireEvent.click(toggle);
    expect(screen.getByRole("region", { name: "地図と条件から探す" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("region", { name: "地図と条件から探す" })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it("places map search controls before the map in keyboard navigation order", () => {
    render(<PubExplorer pubs={pubs} />);

    const workspace = document.querySelector(".map-workspace");

    expect(workspace?.firstElementChild).toHaveClass("map-search-controls");
    expect(workspace?.lastElementChild).toHaveClass("map-canvas");
  });

  it("filters the displayed pubs by pub name", () => {
    render(<PubExplorer pubs={pubs} />);

    fireEvent.change(screen.getByLabelText("店舗を検索"), { target: { value: "tokyo" } });

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Osaka Sample Pub" })).not.toBeInTheDocument();
  });

  it("filters the displayed pubs by prefecture and city area", () => {
    render(<PubExplorer pubs={pubs} />);
    const searchInput = screen.getByLabelText("店舗を検索");

    fireEvent.change(searchInput, { target: { value: "東京都" } });
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Osaka Sample Pub" })).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "千代田区" } });
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Osaka Sample Pub" })).not.toBeInTheDocument();
  });

  it("does not request geolocation until the visitor selects the current-location action", () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>();
    mockGeolocation({ getCurrentPosition });

    render(<PubExplorer pubs={pubs} />);

    expect(
      screen.getByText("現在地に近い掲載エリアへ地図を移動します。位置情報は保存しません。", { exact: false }),
    ).toHaveClass("visually-hidden");
    expect(screen.getByRole("button", { name: "現在地から探す" })).toBeInTheDocument();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it("uses the nearest available prefecture only after the current-location action", async () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((success) => {
      success({
        coords: {
          latitude: 35.658,
          longitude: 139.701,
          accuracy: 20,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
    });
    mockGeolocation({ getCurrentPosition });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<PubExplorer pubs={pubs} />);
    openDetailedFilters();
    fireEvent.click(screen.getByRole("button", { name: "現在地から探す" }));

    await waitFor(() => expect(screen.getByLabelText("都道府県")).toHaveValue("東京都"));
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: false,
      maximumAge: 300000,
      timeout: 5000,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByText("現在地を取得し、近い掲載エリアを表示しました。")).toBeInTheDocument();
    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Osaka Sample Pub" })).not.toBeInTheDocument();
    expect(maplibreMock.mapJumpTo).toHaveBeenLastCalledWith({
      center: [139.701, 35.658],
      zoom: 12,
    });
  });

  it("keeps filters available and shows a retry action when location access is denied", () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((_success, error) => {
      error?.({
        code: 1,
        message: "denied",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      });
    });
    mockGeolocation({ getCurrentPosition });

    render(<PubExplorer pubs={pubs} />);
    openDetailedFilters();
    fireEvent.click(screen.getByRole("button", { name: "現在地から探す" }));

    expect(screen.getByLabelText("都道府県")).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent("位置情報の利用が許可されませんでした。");
    expect(screen.getByRole("button", { name: "現在地を再試行" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "東京都" } });
    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kyoto Sample Pub" })).not.toBeInTheDocument();
    expect(maplibreMock.mapJumpTo).toHaveBeenLastCalledWith({
      center: [139.767, 35.681],
      zoom: 10,
    });
  });

  it("retries location retrieval after a temporary error", async () => {
    let attempts = 0;
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((success, error) => {
      attempts += 1;
      if (attempts === 1) {
        error?.({ code: 3, message: "timeout", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
        return;
      }

      success({
        coords: {
          latitude: 35.658,
          longitude: 139.701,
          accuracy: 20,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
    });
    mockGeolocation({ getCurrentPosition });

    render(<PubExplorer pubs={pubs} />);
    openDetailedFilters();
    fireEvent.click(screen.getByRole("button", { name: "現在地から探す" }));

    expect(screen.getByRole("alert")).toHaveTextContent("現在地を取得できませんでした。");
    fireEvent.click(screen.getByRole("button", { name: "現在地を再試行" }));

    await waitFor(() => expect(screen.getByLabelText("都道府県")).toHaveValue("東京都"));
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("explains when geolocation is unsupported while leaving filters available", () => {
    render(<PubExplorer pubs={pubs} />);
    openDetailedFilters();

    fireEvent.click(screen.getByRole("button", { name: "現在地から探す" }));

    expect(screen.getByText("このブラウザでは位置情報を利用できません。", { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "現在地から探す" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "東京都" } });
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
  });

  it("shows that no listed pub is available when geolocation succeeds with an empty data set", () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((success) => {
      success({
        coords: {
          latitude: 35.658,
          longitude: 139.701,
          accuracy: 20,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
    });
    mockGeolocation({ getCurrentPosition });

    render(<PubExplorer pubs={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "現在地から探す" }));

    expect(screen.getByText("現在地を取得しましたが、現在は掲載店舗がありません。")).toBeInTheDocument();
    expect(screen.queryByText("現在地を取得し、近い掲載エリアを表示しました。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "現在地を更新" })).toBeInTheDocument();
  });
  it("filters the displayed pubs by selected prefecture", () => {
    render(<PubExplorer pubs={pubs} />);
    openDetailedFilters();

    expect(screen.getByRole("option", { name: "すべての都道府県" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "東京都" } });

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Osaka Sample Pub" })).not.toBeInTheDocument();
    expect(maplibreMock.mapJumpTo).toHaveBeenLastCalledWith({
      center: [139.767, 35.681],
      zoom: 10,
    });
  });

  it("links selected pub cards and map markers in both directions", () => {
    render(<PubExplorer pubs={pubs} />);
    openDetailedFilters();
    fireEvent.click(screen.getByRole("checkbox", { name: "閉業した店舗を含める" }));

    const kyotoCard = screen.getByRole("heading", { name: "Kyoto Sample Pub" }).closest("article");
    const tokyoMarker = (maplibreMock.markerConstructor.mock.calls[1][0] as { element: HTMLButtonElement }).element;

    expect(kyotoCard).not.toBeNull();
    fireEvent.click(kyotoCard as HTMLElement);

    const kyotoMarker = (maplibreMock.markerConstructor.mock.calls[2][0] as { element: HTMLButtonElement }).element;
    expect(kyotoCard).toHaveClass("pub-card-selected");
    expect(kyotoMarker).toHaveClass("pub-map-marker-selected");
    expect(kyotoMarker).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(tokyoMarker);

    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" }).closest("article")).toHaveClass(
      "pub-card-selected",
    );
    expect(kyotoCard).not.toHaveClass("pub-card-selected");
    expect(tokyoMarker).toHaveClass("pub-map-marker-selected");
    expect(tokyoMarker).toHaveAttribute("aria-pressed", "true");
  });

  it("clears the selected pub when filters hide it", () => {
    render(<PubExplorer pubs={pubs} />);
    openDetailedFilters();
    const tokyoCard = screen.getByRole("heading", { name: "Tokyo Sample Pub" }).closest("article");

    expect(tokyoCard).not.toBeNull();
    fireEvent.click(tokyoCard as HTMLElement);
    expect(tokyoCard).toHaveClass("pub-card-selected");

    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "大阪府" } });
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "" } });

    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" }).closest("article")).not.toHaveClass(
      "pub-card-selected",
    );
  });

  it("filters the displayed pubs by tag", () => {
    render(<PubExplorer pubs={pubs} />);
    openDetailedFilters();

    fireEvent.click(screen.getByRole("button", { name: "ギネス" }));

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kyoto Sample Pub" })).not.toBeInTheDocument();
  });

  it("filters the displayed pubs by every selected tag", () => {
    render(<PubExplorer pubs={pubs} />);
    openDetailedFilters();

    fireEvent.click(screen.getByRole("button", { name: "ギネス" }));
    fireEvent.click(screen.getByRole("button", { name: "食事あり" }));

    expect(screen.getByRole("button", { name: "ギネス" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "食事あり" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
  });

  it("shows open pubs by default and includes closed pubs with a switch", () => {
    render(<PubExplorer pubs={pubs} />);
    openDetailedFilters();
    const closedToggle = screen.getByRole("checkbox", { name: "閉業した店舗を含める" });

    expect(closedToggle).not.toBeChecked();
    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Osaka Sample Pub" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kyoto Sample Pub" })).not.toBeInTheDocument();

    fireEvent.click(closedToggle);

    expect(closedToggle).toBeChecked();
    expect(screen.getByText("2件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kyoto Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Osaka Sample Pub" })).not.toBeInTheDocument();
  });

  it("keeps the map instance when tag and status filters change", () => {
    render(<PubExplorer pubs={pubs} />);
    openDetailedFilters();

    fireEvent.click(screen.getByRole("button", { name: "ライブ音楽" }));

    expect(maplibreMock.mapConstructor).toHaveBeenCalledTimes(1);
    expect(maplibreMock.mapRemove).not.toHaveBeenCalled();
    expect(maplibreMock.mapJumpTo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: "閉業した店舗を含める" }));

    expect(maplibreMock.mapConstructor).toHaveBeenCalledTimes(1);
    expect(maplibreMock.mapRemove).not.toHaveBeenCalled();
    expect(maplibreMock.mapJumpTo).not.toHaveBeenCalled();
  });

  it("combines search, prefecture, tag, and status filters", () => {
    render(<PubExplorer pubs={pubs} />);
    openDetailedFilters();

    fireEvent.change(screen.getByLabelText("店舗を検索"), { target: { value: "東京都" } });
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "東京都" } });
    fireEvent.click(screen.getByRole("button", { name: "食事あり" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "閉業した店舗を含める" }));

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kyoto Sample Pub" })).not.toBeInTheDocument();
  });

  it("resets detailed filters without clearing the search query", () => {
    render(<PubExplorer pubs={pubs} />);
    openDetailedFilters();

    fireEvent.change(screen.getByLabelText("店舗を検索"), { target: { value: "Tokyo" } });
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "京都府" } });
    fireEvent.click(screen.getByRole("button", { name: "食事あり" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "閉業した店舗を含める" }));

    fireEvent.click(screen.getByRole("button", { name: "条件をリセット" }));

    expect(screen.getByLabelText("店舗を検索")).toHaveValue("Tokyo");
    expect(screen.getByLabelText("都道府県")).toHaveValue("");
    expect(screen.getByRole("button", { name: "食事あり" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("checkbox", { name: "閉業した店舗を含める" })).not.toBeChecked();
    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kyoto Sample Pub" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "条件をリセット" })).not.toBeInTheDocument();
  });

  it("clears the search query", () => {
    render(<PubExplorer pubs={pubs} />);

    fireEvent.change(screen.getByLabelText("店舗を検索"), { target: { value: "京都府" } });
    fireEvent.click(screen.getByRole("button", { name: "クリア" }));

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Osaka Sample Pub" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kyoto Sample Pub" })).not.toBeInTheDocument();
  });
});
