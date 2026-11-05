import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Pub } from "@irishpub-map/shared";
import { PubMap } from "../../apps/mobile/app/pub-map";
import { toPubFeatureCollection } from "../../apps/mobile/app/pub-map-data";

const maplibreProps = vi.hoisted(() => ({
  cameraInitialViewState: undefined as unknown,
  geoJsonData: undefined as unknown,
  sourceData: {} as Record<string, unknown>,
  cameraFlyTo: vi.fn(),
  mapMinHeight: undefined as unknown,
  nearbyListMaxHeight: undefined as unknown,
}));

vi.mock("@maplibre/maplibre-react-native", async () => {
  const React = await import("react");
  return {
    Camera: React.forwardRef(({ initialViewState }: { initialViewState: unknown }, ref) => {
      maplibreProps.cameraInitialViewState = initialViewState;
      React.useImperativeHandle(ref, () => ({ flyTo: maplibreProps.cameraFlyTo }));
      return null;
    }),
    GeoJSONSource: ({
      children,
      onPress,
      data,
      id,
    }: React.PropsWithChildren<{ onPress: (event: unknown) => void; data: unknown; id: string }>) => {
      maplibreProps.geoJsonData = data;
      maplibreProps.sourceData[id] = data;
      return React.createElement(
        "div",
        null,
        React.createElement("button", {
          type: "button",
          onClick: () => onPress({ nativeEvent: { features: [{ properties: { pubId: "pub-1" } }] } }),
        }),
        children,
      );
    },
    Layer: () => null,
    Map: ({
      children,
      onDidFailLoadingMap,
      onDidFinishLoadingMap,
      attribution,
      style,
    }: React.PropsWithChildren<Record<string, unknown>>) => {
      maplibreProps.mapMinHeight = (style as { minHeight?: unknown }).minHeight;
      return React.createElement(
        "div",
        { "data-attribution": attribution },
        React.createElement(
          "button",
          { type: "button", onClick: onDidFinishLoadingMap as () => void },
          "finish map load",
        ),
        React.createElement(
          "button",
          { type: "button", onClick: onDidFailLoadingMap as () => void },
          "simulate map failure",
        ),
        children,
      );
    },
    TransformRequestManager: { addHeader: vi.fn() },
  };
});
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    Pressable: ({
      children,
      onPress,
      accessibilityLabel,
      ...props
    }: React.ComponentProps<"button"> & {
      onPress?: () => void;
      accessibilityLabel?: string;
    }) =>
      React.createElement(
        "button",
        { ...props, "aria-label": accessibilityLabel, type: "button", onClick: onPress },
        children,
      ),
    Text: ({ children, accessibilityRole, ...props }: React.ComponentProps<"span"> & { accessibilityRole?: string }) =>
      React.createElement("span", { ...props, role: accessibilityRole === "alert" ? "alert" : undefined }, children),
    TextInput: ({
      onChangeText,
      accessibilityLabel,
      ...props
    }: React.ComponentProps<"input"> & { onChangeText?: (value: string) => void; accessibilityLabel?: string }) =>
      React.createElement("input", {
        ...props,
        "aria-label": accessibilityLabel,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChangeText?.(event.target.value),
      }),
    View: ({ children, accessibilityRole, ...props }: React.ComponentProps<"div"> & { accessibilityRole?: string }) =>
      React.createElement("div", { ...props, role: accessibilityRole }, children),
    ScrollView: ({ children, style, ...props }: React.PropsWithChildren<React.ComponentProps<"div">>) => {
      const maxHeight = (style as { maxHeight?: unknown } | undefined)?.maxHeight;
      if (maxHeight !== undefined) maplibreProps.nearbyListMaxHeight = maxHeight;
      return React.createElement("div", props, children);
    },
  };
});

const pub: Pub = {
  id: "pub-1",
  name: "The Green Harp",
  prefecture: "東京都",
  address: "Tokyo",
  latitude: 35.68,
  longitude: 139.76,
  tags: [],
  status: "open",
  pubType: "irish",
};

const osakaPub: Pub = {
  ...pub,
  id: "pub-2",
  name: "大阪エール",
  kana: "おおさかえーる",
  prefecture: "大阪府",
  city: "大阪市",
  municipalityCode: "271004",
  address: "Osaka",
  latitude: 34.69,
  longitude: 135.5,
  tags: ["food", "live-music"],
  tagDisplayNames: { food: "料理", "live-music": "生演奏" },
};

describe("Mobile pub map", () => {
  it("converts valid Pub coordinates and omits invalid coordinates", () => {
    expect(
      toPubFeatureCollection([
        pub,
        { ...pub, id: "bad-lat", latitude: Number.NaN },
        { ...pub, id: "bad-long", longitude: 181 },
      ]),
    ).toEqual({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: pub.id,
          properties: { pubId: pub.id },
          geometry: { type: "Point", coordinates: [139.76, 35.68] },
        },
      ],
    });
  });

  it("shows an empty state, selects a Pub, and offers a retry after map failure", () => {
    const onSelectPub = vi.fn();
    const onOpenPub = vi.fn();
    const pubs = [pub];
    const { rerender } = render(
      <PubMap pubs={[]} dataReady onSelectPub={onSelectPub} onOpenPub={onOpenPub} locale="ja" selectedPubId={null} />,
    );
    expect(screen.getByText("地図に表示できるパブはありません。")).toBeTruthy();

    rerender(
      <PubMap pubs={pubs} dataReady onSelectPub={onSelectPub} onOpenPub={onOpenPub} locale="ja" selectedPubId={null} />,
    );
    expect(screen.getByText("1 件のパブ")).toBeTruthy();
    expect(screen.getByText("simulate map failure").parentElement?.getAttribute("data-attribution")).toBe("true");
    const firstFeatureCollection = maplibreProps.geoJsonData;
    expect(maplibreProps.cameraInitialViewState).toEqual({
      bounds: [122, 24, 147, 46],
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
    });

    rerender(
      <PubMap
        pubs={pubs}
        dataReady
        onSelectPub={onSelectPub}
        onOpenPub={onOpenPub}
        locale="ja"
        selectedPubId={pub.id}
      />,
    );
    expect(maplibreProps.geoJsonData).toBe(firstFeatureCollection);

    fireEvent.click(screen.getByRole("button", { name: "" }));
    expect(onSelectPub).toHaveBeenCalledWith(pub.id);
    fireEvent.click(screen.getByRole("button", { name: "The Green Harpの詳細" }));
    expect(onOpenPub).toHaveBeenCalledWith(pub.id);

    fireEvent.click(screen.getByText("simulate map failure"));
    expect(screen.getByRole("alert")).toHaveTextContent("地図を読み込めませんでした。");
    fireEvent.click(screen.getByRole("button", { name: "地図を再読み込み" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("filters markers by search, prefecture, and every selected tag without losing reset", () => {
    render(
      <PubMap
        pubs={[pub, osakaPub]}
        dataReady
        onSelectPub={vi.fn()}
        onOpenPub={vi.fn()}
        locale="ja"
        selectedPubId={null}
      />,
    );
    const input = screen.getByRole("textbox", { name: "パブ名・読み方・地域を検索" });

    fireEvent.change(input, { target: { value: "  ｵｵｻｶ  " } });
    expect(maplibreProps.geoJsonData).toMatchObject({ features: [{ properties: { pubId: "pub-2" } }] });
    expect(screen.getByText("1 件のパブ")).toBeTruthy();

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /東京都/ }));
    expect(maplibreProps.geoJsonData).toMatchObject({ features: [{ properties: { pubId: "pub-1" } }] });

    fireEvent.click(screen.getByRole("button", { name: /東京都/ }));
    fireEvent.click(screen.getByRole("button", { name: "料理" }));
    fireEvent.click(screen.getByRole("button", { name: "生演奏" }));
    expect(maplibreProps.geoJsonData).toMatchObject({ features: [{ properties: { pubId: "pub-2" } }] });

    fireEvent.click(screen.getByRole("button", { name: /東京都/ }));
    expect(maplibreProps.geoJsonData).toEqual({ type: "FeatureCollection", features: [] });
    expect(screen.getByText("条件に一致するパブはありません。")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "検索条件をすべて解除" }));
    expect(maplibreProps.geoJsonData).toMatchObject({
      features: [{ properties: { pubId: "pub-2" } }, { properties: { pubId: "pub-1" } }],
    });
  });

  it("shows nearby pubs and a separate current location marker without changing the pub source", () => {
    maplibreProps.cameraFlyTo.mockClear();
    const locationState = { status: "success" as const, coordinates: { latitude: 35.68, longitude: 139.76 } };
    render(
      <PubMap
        pubs={[osakaPub, pub]}
        dataReady
        locale="ja"
        selectedPubId={null}
        locationState={locationState}
        onSelectPub={vi.fn()}
        onOpenPub={vi.fn()}
      />,
    );

    expect(maplibreProps.sourceData["current-location"]).toEqual({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [139.76, 35.68] } }],
    });
    expect(maplibreProps.sourceData.pubs).toMatchObject({
      features: [{ properties: { pubId: "pub-2" } }, { properties: { pubId: "pub-1" } }],
    });
    expect(screen.getByText("近くのパブ")).toBeTruthy();
    expect(screen.getByRole("button", { name: "The Green Harp, 0 m" })).toBeTruthy();
    expect(maplibreProps.mapMinHeight).toBe(280);
    expect(maplibreProps.nearbyListMaxHeight).toBe(144);
    fireEvent.click(screen.getByText("finish map load"));
    expect(maplibreProps.cameraFlyTo).toHaveBeenCalledWith({ center: [139.76, 35.68], zoom: 13.5, duration: 1000 });

    fireEvent.click(screen.getByRole("button", { name: "料理" }));
    expect(maplibreProps.sourceData.pubs).toMatchObject({ features: [{ properties: { pubId: "pub-2" } }] });
    expect(screen.getByRole("button", { name: /大阪エール/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /The Green Harp/ })).toBeNull();
  });

  it("keeps the map usable after permission denial and offers device settings when blocked", () => {
    const onOpenLocationSettings = vi.fn();
    render(
      <PubMap
        pubs={[pub]}
        dataReady
        locale="ja"
        selectedPubId={null}
        locationState={{ status: "permission-denied", canAskAgain: false }}
        onSelectPub={vi.fn()}
        onOpenPub={vi.fn()}
        onOpenLocationSettings={onOpenLocationSettings}
      />,
    );
    expect(screen.getByText("端末設定で位置情報を許可してください。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "設定を開く" })).toBeTruthy();
    expect(screen.getByText("1 件のパブ")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "設定を開く" }));
    expect(onOpenLocationSettings).toHaveBeenCalledOnce();
  });
});
