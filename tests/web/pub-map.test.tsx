// MapLibre初期化、ピン、表示範囲、WebGLフォールバックを保証するテストです。
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PubMap } from "../../apps/web/app/components/pub-map";
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
    tags: ["guinness"],
    status: "open"
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
    status: "unknown"
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
    status: "closed"
  }
];

const originalGetContext = HTMLCanvasElement.prototype.getContext;

/** WebGLの利用可否を切り替え、通常表示とフォールバックを再現します。 */
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("initializes a MapLibre map and markers when WebGL is available", () => {
    const { unmount } = render(<PubMap pubs={pubs} />);

    expect(maplibreMock.mapConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [139.767, 35.681],
        zoom: 5
      })
    );
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
    expect(maplibreMock.popupSetDOMContent).toHaveBeenCalledTimes(3);
    expect((maplibreMock.popupSetDOMContent.mock.calls[0][0] as HTMLElement).textContent).toBe(
      "Tokyo Sample Pub東京都 / 千代田区"
    );
    expect((maplibreMock.popupSetDOMContent.mock.calls[1][0] as HTMLElement).textContent).toBe("Osaka Sample Pub大阪府");
    expect((maplibreMock.popupSetDOMContent.mock.calls[2][0] as HTMLElement).textContent).toBe("Closed Sample Pub京都府");
    expect(screen.queryByText("地図を表示できませんでした")).not.toBeInTheDocument();

    unmount();

    expect(maplibreMock.mapRemove).toHaveBeenCalledTimes(1);
  });

  it("uses the same gray marker for every non-open status", () => {
    const temporarilyClosedPub: Pub = {
      ...pubs[0],
      id: "temporarily-closed-sample",
      status: "temporarily_closed"
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
      zoom: 12
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
      zoom: 10
    });
  });

  it("fits the map to a prefecture with multiple pubs", () => {
    const secondTokyoPub: Pub = {
      ...pubs[0],
      id: "tokyo-second",
      latitude: 35.72,
      longitude: 139.81
    };

    render(<PubMap pubs={[pubs[0], secondTokyoPub]} focusPubs={[pubs[0], secondTokyoPub]} />);

    expect(maplibreMock.mapFitBounds).toHaveBeenCalledWith(
      [
        [139.767, 35.681],
        [139.81, 35.72]
      ],
      { maxZoom: 10, padding: 48 }
    );
  });

  it("treats popup pub data as text content instead of HTML", () => {
    const htmlLikePub: Pub = {
      ...pubs[0],
      id: "html-like-sample",
      name: '<img src=x onerror="alert(1)">',
      prefecture: "<script>prefecture</script>",
      city: "中央区<script>alert(1)</script>"
    };

    render(<PubMap pubs={[htmlLikePub]} />);

    expect(maplibreMock.popupSetHTML).not.toHaveBeenCalled();
    expect(maplibreMock.popupSetDOMContent).toHaveBeenCalledTimes(1);

    const popupContent = maplibreMock.popupSetDOMContent.mock.calls[0][0] as HTMLElement;
    expect(popupContent.textContent).toBe(
      '<img src=x onerror="alert(1)"><script>prefecture</script> / 中央区<script>alert(1)</script>'
    );
    expect(popupContent.querySelector("img")).toBeNull();
    expect(popupContent.querySelector("script")).toBeNull();
  });

  it("shows a fallback message when WebGL is unavailable", async () => {
    mockWebglContext(null);

    render(<PubMap pubs={pubs} />);

    expect(maplibreMock.mapConstructor).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("地図を表示できませんでした");
    expect(screen.getByText(/店舗一覧からIrish Pubを確認してください/)).toBeInTheDocument();
  });

  it("shows a fallback message when MapLibre initialization throws", async () => {
    maplibreMock.shouldThrowMapConstructor = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<PubMap pubs={pubs} />);

    await waitFor(() => expect(screen.getByRole("status")).toBeInTheDocument());
    expect(consoleError).toHaveBeenCalledWith("Failed to initialize the map.", expect.any(Error));
    expect(maplibreMock.mapRemove).not.toHaveBeenCalled();
  });
});
