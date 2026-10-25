import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Pub } from "@irishpub-map/shared";
import { PubMap } from "../../apps/mobile/app/pub-map";
import { toPubFeatureCollection } from "../../apps/mobile/app/pub-map-data";

vi.mock("@maplibre/maplibre-react-native", async () => {
  const React = await import("react");
  return {
    Camera: () => null,
    GeoJSONSource: ({ children, onPress }: React.PropsWithChildren<{ onPress: (event: unknown) => void }>) =>
      React.createElement(
        "div",
        null,
        React.createElement("button", {
          type: "button",
          onClick: () => onPress({ nativeEvent: { features: [{ properties: { pubId: "pub-1" } }] } }),
        }),
        children,
      ),
    Layer: () => null,
    Map: ({ children, onDidFailLoadingMap, attribution }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement(
        "div",
        { "data-attribution": attribution },
        React.createElement(
          "button",
          { type: "button", onClick: onDidFailLoadingMap as () => void },
          "simulate map failure",
        ),
        children,
      ),
    TransformRequestManager: { addHeader: vi.fn() },
  };
});
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    Pressable: ({ children, onPress, ...props }: React.ComponentProps<"button"> & { onPress?: () => void }) =>
      React.createElement("button", { ...props, type: "button", onClick: onPress }, children),
    Text: ({ children, accessibilityRole, ...props }: React.ComponentProps<"span"> & { accessibilityRole?: string }) =>
      React.createElement("span", { ...props, role: accessibilityRole === "alert" ? "alert" : undefined }, children),
    View: ({ children, accessibilityRole, ...props }: React.ComponentProps<"div"> & { accessibilityRole?: string }) =>
      React.createElement("div", { ...props, role: accessibilityRole }, children),
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
    const { rerender } = render(
      <PubMap pubs={[]} dataReady onSelectPub={onSelectPub} locale="ja" selectedPubId={null} />,
    );
    expect(screen.getByText("地図に表示できるパブはありません。")).toBeTruthy();

    rerender(<PubMap pubs={[pub]} dataReady onSelectPub={onSelectPub} locale="ja" selectedPubId={null} />);
    expect(screen.getByText("1 件のパブ")).toBeTruthy();
    expect(screen.getByText("simulate map failure").parentElement?.getAttribute("data-attribution")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "" }));
    expect(onSelectPub).toHaveBeenCalledWith(pub.id);

    fireEvent.click(screen.getByText("simulate map failure"));
    expect(screen.getByRole("alert")).toHaveTextContent("地図を読み込めませんでした。");
    fireEvent.click(screen.getByRole("button", { name: "地図を再読み込み" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
