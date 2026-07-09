import { render, screen, waitFor } from "@testing-library/react";
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
const originalGeolocation = navigator.geolocation;

function mockWebglContext(context: object | null) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId: string) => {
    if (contextId === "webgl" || contextId === "experimental-webgl") {
      return context as never;
    }

    return null;
  });
}

function mockGeolocation(geolocation: Partial<Geolocation> | undefined) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: geolocation
  });
}

describe("PubMap", () => {
  beforeEach(() => {
    resetMaplibreMock();
    mockWebglContext({});
    mockGeolocation(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    mockGeolocation(originalGeolocation);
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
    expect(openMarkerOptions.element).toHaveClass("pub-map-marker", "pub-map-marker-guinness");
    expect(openMarkerOptions.element).toHaveAccessibleName("営業中 Irish Pub");
    expect(openMarkerOptions.element.querySelector(".pub-map-marker-foam")).not.toBeNull();
    expect(openMarkerOptions.element.querySelector(".pub-map-marker-stout")).not.toBeNull();
    expect(maplibreMock.markerConstructor).toHaveBeenNthCalledWith(2, { color: "#6b7280" });
    expect(maplibreMock.markerConstructor).toHaveBeenNthCalledWith(3, { color: "#d92d20" });
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

  it("moves the map to the current location when geolocation succeeds", () => {
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

    render(<PubMap pubs={pubs} />);

    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: false,
      maximumAge: 300000,
      timeout: 5000
    });
    expect(maplibreMock.mapJumpTo).toHaveBeenCalledWith({
      center: [139.701, 35.658],
      zoom: 12
    });
  });

  it("keeps the default map view when geolocation fails", () => {
    const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((_success, error) => {
      error?.({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
    });
    mockGeolocation({ getCurrentPosition });

    render(<PubMap pubs={pubs} />);

    expect(getCurrentPosition).toHaveBeenCalled();
    expect(maplibreMock.mapJumpTo).not.toHaveBeenCalled();
    expect(screen.queryByText("地図を表示できませんでした")).not.toBeInTheDocument();
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
