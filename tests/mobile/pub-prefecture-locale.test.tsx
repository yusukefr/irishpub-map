import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureCollection, Point } from "geojson";
import type { Pub } from "@irishpub-map/shared";
import HomeScreen from "../../apps/mobile/app/index";

const { getPubs, mapState } = vi.hoisted(() => ({ getPubs: vi.fn(), mapState: { geoJsonData: undefined as unknown } }));

vi.mock("@irishpub-map/api-client", () => ({ getPubs }));
vi.mock("../../apps/mobile/app/router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@maplibre/maplibre-react-native", async () => {
  const React = await import("react");
  return {
    Camera: () => null,
    GeoJSONSource: ({ data, children }: React.PropsWithChildren<{ data: unknown }>) => {
      mapState.geoJsonData = data;
      return React.createElement("div", null, children);
    },
    Layer: () => null,
    Map: ({ children }: React.PropsWithChildren) => React.createElement("div", null, children),
    TransformRequestManager: { addHeader: vi.fn() },
  };
});
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    ActivityIndicator: () => React.createElement("span", { role: "progressbar" }),
    Pressable: ({
      children,
      onPress,
      accessibilityLabel,
      accessibilityState,
      ...props
    }: React.ComponentProps<"button"> & {
      onPress?: () => void;
      accessibilityLabel?: string;
      accessibilityState?: { selected?: boolean };
    }) =>
      React.createElement(
        "button",
        {
          ...props,
          "aria-label": accessibilityLabel,
          "aria-pressed": accessibilityState?.selected,
          type: "button",
          onClick: onPress,
        },
        children,
      ),
    ScrollView: ({ children }: React.PropsWithChildren) => React.createElement("div", null, children),
    Text: ({ children, accessibilityRole, ...props }: React.ComponentProps<"span"> & { accessibilityRole?: string }) =>
      React.createElement("span", { ...props, role: accessibilityRole === "alert" ? "alert" : undefined }, children),
    TextInput: ({
      onChangeText,
      accessibilityLabel,
      ...props
    }: React.ComponentProps<"input"> & {
      onChangeText?: (value: string) => void;
      accessibilityLabel?: string;
    }) =>
      React.createElement("input", {
        ...props,
        "aria-label": accessibilityLabel,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChangeText?.(event.target.value),
      }),
    View: ({ children, accessibilityRole }: React.PropsWithChildren<{ accessibilityRole?: string }>) =>
      React.createElement("div", { role: accessibilityRole === "alert" ? "alert" : undefined }, children),
  };
});

const tokyoPub: Pub = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "The Green Harp",
  prefecture: "東京都",
  city: "千代田区",
  municipalityCode: "131016",
  address: "東京都千代田区1-1-1",
  latitude: 35.68,
  longitude: 139.76,
  tags: [],
  status: "open",
  pubType: "irish",
};

describe("Mobile prefecture filter across locales", () => {
  beforeEach(() => {
    getPubs.mockReset();
    mapState.geoJsonData = undefined;
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "ja-JP",
    } as Intl.ResolvedDateTimeFormatOptions);
  });

  it("keeps the same prefecture selected when the API returns its English name", async () => {
    getPubs.mockResolvedValueOnce([tokyoPub]).mockResolvedValueOnce([{ ...tokyoPub, prefecture: "Tokyo" }]);
    render(<HomeScreen />);
    await screen.findByText("1 件のパブ");

    fireEvent.click(screen.getByRole("button", { name: "東京都" }));
    expect(mapState.geoJsonData).toMatchObject({ features: [{ properties: { pubId: tokyoPub.id } }] });

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(await screen.findByText("1 pubs")).toBeTruthy();
    await waitFor(() => {
      const collection = mapState.geoJsonData as FeatureCollection<Point, { pubId: string }>;
      expect(collection.features.map((feature) => feature.properties.pubId)).toEqual([tokyoPub.id]);
    });
    expect(screen.getByRole("button", { name: /Tokyo/ })).toHaveAttribute("aria-pressed", "true");
    expect(getPubs).toHaveBeenCalledTimes(2);
    expect(getPubs).toHaveBeenLastCalledWith(expect.objectContaining({ locale: "en" }));
  });
});
