// MapLibre初期化、ピン、表示範囲、WebGLフォールバックを保証するテストです。
import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PubMap } from "../../apps/web/app/components/pub-map";
import type { Pub } from "../../packages/shared/src/pub";
import { emitMapEvent, maplibreMock, resetMaplibreMock } from "../mocks/maplibre-gl";

const globalStyles = readFileSync("apps/web/app/globals.css", "utf8");
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
    instagramUrl: "https://instagram.example.com/tokyo-sample",
    tags: ["guinness"],
    status: "open",
  },
  {
    id: "osaka-sample",
    name: "Osaka Sample Pub",
    prefecture: "大阪府",
    address: "大阪府大阪市1-1-1",
    latitude: 34.693,
    longitude: 135.502,
    websiteUrl: null,
    googleMapsUrl: null,
    instagramUrl: null,
    tags: [],
    status: "unknown",
  },
  {
    id: "closed-sample",
    name: "Closed Sample Pub",
    prefecture: "京都府",
    address: "京都府京都市1-1-1",
    latitude: 35.011,
    longitude: 135.768,
    websiteUrl: null,
    googleMapsUrl: null,
    instagramUrl: null,
    tags: [],
    status: "closed",
  },
];

const originalGetContext = HTMLCanvasElement.prototype.getContext;

/** WebGLの利用可否を切り替え、通常表示とフォールバックを再現します。 */
function mockHoverCapability(canHover: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: canHover,
      media: "(hover: hover) and (pointer: fine)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  );
}

function mockWebglContext(context: object | null) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId: string) => {
    if (contextId === "webgl" || contextId === "experimental-webgl") {
      return context as never;
    }

    return null;
  });
}

describe("PubMap", () => {
  beforeEach(() => {
    resetMaplibreMock();
    mockWebglContext({});
    mockHoverCapability(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("initializes a MapLibre map and markers when WebGL is available", () => {
    const { unmount } = render(<PubMap pubs={pubs} />);

    expect(maplibreMock.mapConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [139.767, 35.681],
        zoom: 5,
      }),
    );
    const mapOptions = maplibreMock.mapConstructor.mock.calls[0][0] as { style: string };
    expect(mapOptions.style).toBe("https://tiles.openfreemap.org/styles/bright");
    expect(maplibreMock.setWorkerUrl).toHaveBeenCalledWith("/maplibre/maplibre-gl-worker.mjs");

    expect(maplibreMock.navigationControl).toHaveBeenCalledWith({ visualizePitch: true });
    expect(maplibreMock.mapAddControl).toHaveBeenCalledTimes(1);
    expect(maplibreMock.mapJumpTo).not.toHaveBeenCalled();
    expect(maplibreMock.markerSetLngLat).toHaveBeenNthCalledWith(1, [139.767, 35.681]);
    expect(maplibreMock.markerSetLngLat).toHaveBeenNthCalledWith(2, [135.502, 34.693]);
    expect(maplibreMock.markerSetLngLat).toHaveBeenNthCalledWith(3, [135.768, 35.011]);
    const openMarkerOptions = maplibreMock.markerConstructor.mock.calls[0][0] as {
      anchor: string;
      element: HTMLElement;
    };
    expect(openMarkerOptions.anchor).toBe("bottom");
    expect(openMarkerOptions.element).toHaveClass("pub-map-marker", "pub-map-marker-open", "pub-map-marker-guinness");
    expect(openMarkerOptions.element).toHaveAccessibleName("店舗を選択: Tokyo Sample Pub");
    expect(openMarkerOptions.element).toHaveAttribute("aria-pressed", "false");
    expect(openMarkerOptions.element.querySelector(".pub-map-marker-foam")).not.toBeNull();
    expect(openMarkerOptions.element.querySelector(".pub-map-marker-stout")).not.toBeNull();
    const unknownMarkerOptions = maplibreMock.markerConstructor.mock.calls[1][0] as { element: HTMLElement };
    const closedMarkerOptions = maplibreMock.markerConstructor.mock.calls[2][0] as { element: HTMLElement };
    expect(unknownMarkerOptions.element).toHaveClass("pub-map-marker-unknown");
    expect(unknownMarkerOptions.element).toHaveStyle({ "--pub-marker-color": "#6b7280" });
    expect(closedMarkerOptions.element).toHaveClass("pub-map-marker-closed");
    expect(closedMarkerOptions.element).toHaveStyle({ "--pub-marker-color": "#6b7280" });
    expect(maplibreMock.popupSetHTML).not.toHaveBeenCalled();
    expect(maplibreMock.popupConstructor).toHaveBeenNthCalledWith(1, {
      offset: 18,
      closeButton: false,
      closeOnClick: true,
      className: "pub-map-popup",
    });
    expect(maplibreMock.popupSetLngLat).toHaveBeenNthCalledWith(1, [139.767, 35.681]);
    expect(maplibreMock.popupSetLngLat).toHaveBeenNthCalledWith(2, [135.502, 34.693]);
    expect(maplibreMock.popupSetLngLat).toHaveBeenNthCalledWith(3, [135.768, 35.011]);
    expect(maplibreMock.markerSetPopup).not.toHaveBeenCalled();
    expect(maplibreMock.popupSetMaxWidth).toHaveBeenCalledWith("min(320px, calc(100vw - 32px))");
    expect(maplibreMock.popupSetDOMContent).toHaveBeenCalledTimes(3);

    const tokyoPopup = maplibreMock.popupSetDOMContent.mock.calls[0][0] as HTMLElement;
    expect(within(tokyoPopup).getByRole("heading", { name: "Tokyo Sample Pub" })).toBeTruthy();
    expect(within(tokyoPopup).getByText("東京都千代田区1-1-1")).toBeTruthy();
    expect(within(tokyoPopup).getByRole("group", { name: "Tokyo Sample Pub の外部リンク" })).toBeTruthy();
    const popupLinks = within(tokyoPopup).getAllByRole("link");
    expect(popupLinks).toHaveLength(3);
    expect(
      within(tokyoPopup).getByRole("link", { name: "Tokyo Sample Pub の公式サイトを新しいタブで開く" }),
    ).toHaveAttribute("href", "https://example.com/");
    expect(
      within(tokyoPopup).getByRole("link", { name: "Tokyo Sample Pub のGoogle Mapsを新しいタブで開く" }),
    ).toHaveAttribute("title", "Google Maps");
    expect(
      within(tokyoPopup).getByRole("link", { name: "Tokyo Sample Pub のInstagramを新しいタブで開く" }),
    ).toHaveAttribute("title", "Instagram");
    popupLinks.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    const osakaPopup = maplibreMock.popupSetDOMContent.mock.calls[1][0] as HTMLElement;
    expect(within(osakaPopup).getByText("大阪府大阪市1-1-1")).toBeTruthy();
    expect(within(osakaPopup).queryByRole("link")).toBeNull();
    expect(screen.queryByText("地図を表示できませんでした")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("地図を読み込んでいます…");
    expect(maplibreMock.mapOn).toHaveBeenCalledWith("load", expect.any(Function));
    expect(maplibreMock.mapOn).toHaveBeenCalledWith("error", expect.any(Function));

    act(() => emitMapEvent("load"));

    expect(screen.queryByText("地図を読み込んでいます…")).not.toBeInTheDocument();
    expect(maplibreMock.mapSetLayoutProperty).toHaveBeenCalledTimes(9);
    expect(maplibreMock.mapSetLayoutProperty).toHaveBeenCalledWith("label_country_1", "text-field", [
      "coalesce",
      ["get", "name:ja"],
      ["get", "name"],
    ]);

    unmount();

    expect(maplibreMock.mapRemove).toHaveBeenCalledTimes(1);
  });

  it("resizes MapLibre when the map container changes and disconnects on unmount", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    let resizeCallback: ResizeObserverCallback | undefined;
    const resizeObserver = { observe, disconnect };
    const resizeObserverConstructor = vi.fn(function (callback: ResizeObserverCallback) {
      resizeCallback = callback;
      return resizeObserver as unknown as ResizeObserver;
    });
    vi.stubGlobal("ResizeObserver", resizeObserverConstructor);

    const { container, unmount } = render(<PubMap pubs={pubs} />);
    const mapContainer = container.querySelector(".map-canvas");
    expect(mapContainer).not.toBeNull();

    expect(resizeObserverConstructor).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledWith(mapContainer);

    resizeCallback?.([], resizeObserver as unknown as ResizeObserver);
    expect(maplibreMock.mapResize).toHaveBeenCalledOnce();

    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("updates only place-name layers when the locale changes without rebuilding the map", () => {
    const { rerender } = render(<PubMap pubs={pubs} locale="ja" />);

    act(() => emitMapEvent("load"));
    maplibreMock.mapSetLayoutProperty.mockClear();
    maplibreMock.mapIsStyleLoaded.mockReturnValue(true);

    rerender(<PubMap pubs={pubs} locale="en" />);

    expect(maplibreMock.mapConstructor).toHaveBeenCalledTimes(1);
    expect(maplibreMock.mapSetLayoutProperty).toHaveBeenCalledTimes(9);
    expect(maplibreMock.mapSetLayoutProperty).toHaveBeenCalledWith("label_city", "text-field", [
      "coalesce",
      ["get", "name:en"],
      ["get", "name"],
    ]);
    expect(maplibreMock.mapSetLayoutProperty).not.toHaveBeenCalledWith("poi_r1", "text-field", expect.anything());

    const englishPopup = maplibreMock.popupSetDOMContent.mock.calls[3][0] as HTMLElement;
    expect(
      within(englishPopup).getByRole("link", { name: "Open Tokyo Sample Pub's website in a new tab" }),
    ).toBeTruthy();
    expect(
      within(englishPopup).getByRole("link", { name: "Open Tokyo Sample Pub on Google Maps in a new tab" }),
    ).toBeTruthy();
  });

  it("keeps the popup open while moving from a marker to its interactive content", () => {
    vi.useFakeTimers();
    mockHoverCapability(true);
    render(<PubMap pubs={[pubs[0]]} />);

    const marker = (maplibreMock.markerConstructor.mock.calls[0][0] as { element: HTMLElement }).element;
    const popupContent = maplibreMock.popupSetDOMContent.mock.calls[0][0] as HTMLElement;

    fireEvent.mouseEnter(marker);
    expect(maplibreMock.popupAddTo).toHaveBeenCalledTimes(1);

    fireEvent.mouseLeave(marker);
    act(() => vi.advanceTimersByTime(100));
    fireEvent.mouseEnter(popupContent);
    act(() => vi.advanceTimersByTime(160));
    expect(maplibreMock.popupRemove).not.toHaveBeenCalled();

    fireEvent.mouseLeave(popupContent);
    act(() => vi.advanceTimersByTime(160));
    expect(maplibreMock.popupRemove).toHaveBeenCalledTimes(1);
  });

  it("keeps a hover-open popup pinned after the marker is clicked", () => {
    vi.useFakeTimers();
    mockHoverCapability(true);
    render(<PubMap pubs={[pubs[0]]} />);

    const marker = (maplibreMock.markerConstructor.mock.calls[0][0] as { element: HTMLElement }).element;

    fireEvent.mouseEnter(marker);
    expect(maplibreMock.popupAddTo).toHaveBeenCalledTimes(1);

    fireEvent.click(marker);
    fireEvent.mouseLeave(marker);
    act(() => vi.advanceTimersByTime(160));

    expect(maplibreMock.popupAddTo).toHaveBeenCalledTimes(1);
    expect(maplibreMock.popupRemove).not.toHaveBeenCalled();
  });

  it("opens on marker tap and closes on an outside tap on touch devices", () => {
    mockHoverCapability(false);
    render(<PubMap pubs={[pubs[0]]} />);

    const marker = (maplibreMock.markerConstructor.mock.calls[0][0] as { element: HTMLElement }).element;
    fireEvent.click(marker);

    expect(maplibreMock.popupAddTo).toHaveBeenCalledTimes(1);
    expect(maplibreMock.markerSetPopup).not.toHaveBeenCalled();

    act(() => emitMapEvent("click"));

    expect(maplibreMock.popupRemove).toHaveBeenCalledTimes(1);
  });

  it("uses the same gray marker for every non-open status", () => {
    const temporarilyClosedPub: Pub = {
      ...pubs[0],
      id: "temporarily-closed-sample",
      status: "temporarily_closed",
    };

    render(<PubMap pubs={[...pubs, temporarilyClosedPub]} />);

    const markerOptions = maplibreMock.markerConstructor.mock.calls[3][0] as { element: HTMLElement };
    expect(markerOptions.element).toHaveClass("pub-map-marker-temporarily_closed");
    expect(markerOptions.element).toHaveStyle({ "--pub-marker-color": "#6b7280" });
  });

  it("moves the map to the provided current location", () => {
    render(<PubMap pubs={pubs} currentLocation={{ latitude: 35.658, longitude: 139.701 }} />);

    const currentMarkerOptions = maplibreMock.markerConstructor.mock.calls[3][0] as {
      anchor: string;
      element: HTMLElement;
    };
    expect(currentMarkerOptions.anchor).toBe("center");
    expect(currentMarkerOptions.element).toHaveClass("current-location-marker");
    expect(currentMarkerOptions.element).toHaveAccessibleName("現在地");
    expect(maplibreMock.markerSetLngLat).toHaveBeenLastCalledWith([139.701, 35.658]);
    expect(maplibreMock.mapJumpTo).toHaveBeenCalledWith({
      center: [139.701, 35.658],
      zoom: 12,
    });
  });

  it("selects a pub from its marker and updates the selected marker without rebuilding the map", () => {
    const onSelectPub = vi.fn();
    const { rerender } = render(<PubMap pubs={pubs} onSelectPub={onSelectPub} />);
    const tokyoMarker = (maplibreMock.markerConstructor.mock.calls[0][0] as { element: HTMLButtonElement }).element;

    fireEvent.click(tokyoMarker);

    expect(onSelectPub).toHaveBeenCalledWith("tokyo-sample");

    rerender(<PubMap pubs={pubs} selectedPubId="tokyo-sample" onSelectPub={onSelectPub} />);

    expect(tokyoMarker).toHaveClass("pub-map-marker-selected");
    expect(tokyoMarker).toHaveAttribute("aria-pressed", "true");
    expect(maplibreMock.mapConstructor).toHaveBeenCalledTimes(1);
  });

  it("updates markers without rebuilding the map when pubs are filtered", () => {
    const { rerender } = render(<PubMap pubs={pubs} />);

    rerender(<PubMap pubs={[pubs[0]]} />);

    expect(maplibreMock.mapConstructor).toHaveBeenCalledTimes(1);
    expect(maplibreMock.mapRemove).not.toHaveBeenCalled();
    expect(maplibreMock.markerRemove).toHaveBeenCalledTimes(3);
    expect(maplibreMock.markerConstructor).toHaveBeenCalledTimes(4);
    expect(maplibreMock.markerSetLngLat).toHaveBeenLastCalledWith([139.767, 35.681]);
  });

  it("moves the map to a prefecture with one pub", () => {
    render(<PubMap pubs={[pubs[1]]} focusPubs={[pubs[1]]} />);

    expect(maplibreMock.mapJumpTo).toHaveBeenCalledWith({
      center: [135.502, 34.693],
      zoom: 10,
    });
  });

  it("fits the map to a prefecture with multiple pubs", () => {
    const secondTokyoPub: Pub = {
      ...pubs[0],
      id: "tokyo-second",
      latitude: 35.72,
      longitude: 139.81,
    };

    render(<PubMap pubs={[pubs[0], secondTokyoPub]} focusPubs={[pubs[0], secondTokyoPub]} />);

    expect(maplibreMock.mapFitBounds).toHaveBeenCalledWith(
      [
        [139.767, 35.681],
        [139.81, 35.72],
      ],
      { maxZoom: 10, padding: 48 },
    );
  });

  it("treats popup pub data as text content instead of HTML", () => {
    const htmlLikePub: Pub = {
      ...pubs[0],
      id: "html-like-sample",
      name: '<img src=x onerror="alert(1)">',
      address: "<script>address</script>",
    };

    render(<PubMap pubs={[htmlLikePub]} />);

    expect(maplibreMock.popupSetHTML).not.toHaveBeenCalled();
    expect(maplibreMock.popupSetDOMContent).toHaveBeenCalledTimes(1);

    const popupContent = maplibreMock.popupSetDOMContent.mock.calls[0][0] as HTMLElement;
    expect(popupContent.textContent).toContain('<img src=x onerror="alert(1)"><script>address</script>');
    expect(popupContent.querySelector("img")).toBeNull();
    expect(popupContent.querySelector("script")).toBeNull();
  });

  it("omits external links with unsupported or malformed URLs", () => {
    const unsafeUrlPub: Pub = {
      ...pubs[0],
      websiteUrl: "javascript:alert(1)",
      googleMapsUrl: "data:text/html,unsafe",
      instagramUrl: "not-a-url",
    };

    render(<PubMap pubs={[unsafeUrlPub]} />);

    const popupContent = maplibreMock.popupSetDOMContent.mock.calls[0][0] as HTMLElement;
    expect(within(popupContent).queryByRole("link")).toBeNull();
    expect(within(popupContent).queryByRole("group")).toBeNull();
  });

  it("shows a fallback message when WebGL is unavailable", async () => {
    mockWebglContext(null);

    render(<PubMap pubs={pubs} />);

    expect(maplibreMock.mapConstructor).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("地図を表示できませんでした");
    expect(screen.queryByText("地図を読み込んでいます…")).not.toBeInTheDocument();
    expect(screen.getByText(/結果件数ボタンから掲載店舗の一覧を確認できます/)).toBeInTheDocument();
  });

  it("shows a fallback message when MapLibre initialization throws", async () => {
    maplibreMock.shouldThrowMapConstructor = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<PubMap pubs={pubs} />);

    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(consoleError).toHaveBeenCalledWith("Failed to initialize the map.", expect.any(Error));
    expect(maplibreMock.mapRemove).not.toHaveBeenCalled();
  });

  it("keeps the map available when an individual resource error occurs before loading", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(<PubMap pubs={pubs} />);

    act(() => emitMapEvent("error", { error: new Error("Tile request failed") }));

    expect(consoleWarn).toHaveBeenCalledWith("MapLibre resource error.", expect.any(Error));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("地図を読み込んでいます…")).toBeInTheDocument();

    act(() => emitMapEvent("load"));

    expect(screen.queryByText("地図を読み込んでいます…")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error message when the first map load times out", () => {
    vi.useFakeTimers();

    render(<PubMap pubs={pubs} />);

    act(() => vi.advanceTimersByTime(15_000));

    expect(screen.getByRole("alert")).toHaveTextContent("地図タイルの読み込みに失敗しました");
  });

  it("provides pointer cues and 44px popup link targets", () => {
    expect(globalStyles).toMatch(/\.pub-map-marker \{[\s\S]*cursor: pointer;/);
    expect(globalStyles).toMatch(/\.pub-map-popup-links a \{[\s\S]*min-width: 44px;[\s\S]*min-height: 44px;/);
  });

  it("uses a static loading indicator when reduced motion is preferred", () => {
    expect(globalStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(globalStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.map-loading-indicator \{\s*animation: none;/,
    );
  });
});
