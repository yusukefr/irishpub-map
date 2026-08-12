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
    address: "東京都千代田区1-1-1",
    latitude: 35.681,
    longitude: 139.767,
    websiteUrl: "https://example.com",
    googleMapsUrl: "https://maps.example.com",
    instagramUrl: null,
    tags: ["guinness", "food"],
    status: "open"
  },
  {
    id: "osaka-sample",
    name: "Osaka Sample Pub",
    prefecture: "大阪府",
    city: "大阪市",
    address: "大阪府大阪市1-1-1",
    latitude: 34.693,
    longitude: 135.502,
    websiteUrl: null,
    googleMapsUrl: null,
    instagramUrl: null,
    tags: ["live-music"],
    status: "unknown"
  },
  {
    id: "kyoto-sample",
    name: "Kyoto Sample Pub",
    prefecture: "京都府",
    address: "京都府京都市1-1-1",
    latitude: 35.011,
    longitude: 135.768,
    websiteUrl: null,
    googleMapsUrl: null,
    instagramUrl: null,
    tags: ["food"],
    status: "closed"
  }
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
    value: geolocation
  });
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

  it("filters the displayed pubs by pub name", () => {
    render(<PubExplorer pubs={pubs} />);

    fireEvent.change(screen.getByLabelText("店舗を検索"), { target: { value: "osaka" } });

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Osaka Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tokyo Sample Pub" })).not.toBeInTheDocument();
  });

  it("filters the displayed pubs by prefecture and city area", () => {
    render(<PubExplorer pubs={pubs} />);
    const searchInput = screen.getByLabelText("店舗を検索");

    fireEvent.change(searchInput, { target: { value: "東京都" } });
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Osaka Sample Pub" })).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "大阪市" } });
    expect(screen.getByRole("heading", { name: "Osaka Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tokyo Sample Pub" })).not.toBeInTheDocument();
  });

  it("defaults to the nearest available prefecture when geolocation succeeds", async () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((success) => {
      success({
        coords: {
          latitude: 35.658,
          longitude: 139.701,
          accuracy: 20,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      });
    });
    mockGeolocation({ getCurrentPosition });

    render(<PubExplorer pubs={pubs} />);

    await waitFor(() => expect(screen.getByLabelText("都道府県")).toHaveValue("東京都"));
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: false,
      maximumAge: 300000,
      timeout: 5000
    });
    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Osaka Sample Pub" })).not.toBeInTheDocument();
    expect(maplibreMock.mapJumpTo).toHaveBeenLastCalledWith({
      center: [139.701, 35.658],
      zoom: 12
    });
  });

  it("keeps all prefectures selected when geolocation fails", () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((_success, error) => {
      error?.({
        code: 1,
        message: "denied",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3
      });
    });
    mockGeolocation({ getCurrentPosition });

    render(<PubExplorer pubs={pubs} />);

    expect(screen.getByLabelText("都道府県")).toHaveValue("");
    expect(screen.getByText("3件のPubが見つかりました")).toBeInTheDocument();
    expect(maplibreMock.mapJumpTo).not.toHaveBeenCalled();
  });

  it("filters the displayed pubs by selected prefecture", () => {
    render(<PubExplorer pubs={pubs} />);

    expect(screen.getByRole("option", { name: "すべての都道府県" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "大阪府" } });

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Osaka Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tokyo Sample Pub" })).not.toBeInTheDocument();
    expect(maplibreMock.mapJumpTo).toHaveBeenLastCalledWith({
      center: [135.502, 34.693],
      zoom: 10
    });
  });

  it("links selected pub cards and map markers in both directions", () => {
    render(<PubExplorer pubs={pubs} />);
    const osakaCard = screen.getByRole("heading", { name: "Osaka Sample Pub" }).closest("article");
    const tokyoMarker = (maplibreMock.markerConstructor.mock.calls[0][0] as { element: HTMLButtonElement }).element;

    expect(osakaCard).not.toBeNull();
    fireEvent.click(osakaCard as HTMLElement);

    const osakaMarker = (maplibreMock.markerConstructor.mock.calls[1][0] as { element: HTMLButtonElement }).element;
    expect(osakaCard).toHaveClass("pub-card-selected");
    expect(osakaMarker).toHaveClass("pub-map-marker-selected");
    expect(osakaMarker).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(tokyoMarker);

    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" }).closest("article")).toHaveClass("pub-card-selected");
    expect(osakaCard).not.toHaveClass("pub-card-selected");
    expect(tokyoMarker).toHaveClass("pub-map-marker-selected");
    expect(tokyoMarker).toHaveAttribute("aria-pressed", "true");
  });

  it("clears the selected pub when filters hide it", () => {
    render(<PubExplorer pubs={pubs} />);
    const tokyoCard = screen.getByRole("heading", { name: "Tokyo Sample Pub" }).closest("article");

    expect(tokyoCard).not.toBeNull();
    fireEvent.click(tokyoCard as HTMLElement);
    expect(tokyoCard).toHaveClass("pub-card-selected");

    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "大阪府" } });
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "" } });

    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" }).closest("article")).not.toHaveClass("pub-card-selected");
  });

  it("filters the displayed pubs by tag", () => {
    render(<PubExplorer pubs={pubs} />);

    expect(screen.getByRole("option", { name: "ライブ音楽" })).toHaveValue("live-music");

    fireEvent.change(screen.getByLabelText("タグ"), { target: { value: "live-music" } });

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Osaka Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tokyo Sample Pub" })).not.toBeInTheDocument();
  });

  it("filters the displayed pubs by status", () => {
    render(<PubExplorer pubs={pubs} />);
    const statusFilter = screen.getByLabelText("営業状況");

    expect(statusFilter.querySelectorAll("option")).toHaveLength(2);
    expect(screen.getAllByRole("option", { name: "すべての営業状況" })).toHaveLength(1);
    expect(screen.getAllByRole("option", { name: "営業中" })).toHaveLength(1);
    expect(statusFilter).toHaveValue("");

    fireEvent.change(statusFilter, { target: { value: "open" } });

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Osaka Sample Pub" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kyoto Sample Pub" })).not.toBeInTheDocument();
  });

  it("combines search, prefecture, tag, and status filters", () => {
    render(<PubExplorer pubs={pubs} />);

    fireEvent.change(screen.getByLabelText("店舗を検索"), { target: { value: "東京都" } });
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "東京都" } });
    fireEvent.change(screen.getByLabelText("タグ"), { target: { value: "food" } });
    fireEvent.change(screen.getByLabelText("営業状況"), { target: { value: "open" } });

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kyoto Sample Pub" })).not.toBeInTheDocument();
  });

  it("resets all active search conditions", () => {
    render(<PubExplorer pubs={pubs} />);

    fireEvent.change(screen.getByLabelText("店舗を検索"), { target: { value: "京都府" } });
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "京都府" } });
    fireEvent.change(screen.getByLabelText("タグ"), { target: { value: "food" } });
    fireEvent.change(screen.getByLabelText("営業状況"), { target: { value: "closed" } });

    fireEvent.click(screen.getByRole("button", { name: "条件をリセット" }));

    expect(screen.getByLabelText("店舗を検索")).toHaveValue("");
    expect(screen.getByLabelText("都道府県")).toHaveValue("");
    expect(screen.getByLabelText("タグ")).toHaveValue("");
    expect(screen.getByLabelText("営業状況")).toHaveValue("");
    expect(screen.getByText("3件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "条件をリセット" })).not.toBeInTheDocument();
  });

  it("clears the search query", () => {
    render(<PubExplorer pubs={pubs} />);

    fireEvent.change(screen.getByLabelText("店舗を検索"), { target: { value: "京都府" } });
    fireEvent.click(screen.getByRole("button", { name: "クリア" }));

    expect(screen.getByText("3件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Osaka Sample Pub" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kyoto Sample Pub" })).toBeInTheDocument();
  });
});
