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
  }
];

const originalGetContext = HTMLCanvasElement.prototype.getContext;

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
    expect(maplibreMock.markerSetLngLat).toHaveBeenNthCalledWith(1, [139.767, 35.681]);
    expect(maplibreMock.markerSetLngLat).toHaveBeenNthCalledWith(2, [135.502, 34.693]);
    expect(maplibreMock.popupSetHTML).toHaveBeenCalledWith("<strong>Tokyo Sample Pub</strong><br>東京都 / 千代田区");
    expect(maplibreMock.popupSetHTML).toHaveBeenCalledWith("<strong>Osaka Sample Pub</strong><br>大阪府");
    expect(screen.queryByText("地図を表示できませんでした")).not.toBeInTheDocument();

    unmount();

    expect(maplibreMock.mapRemove).toHaveBeenCalledTimes(1);
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
