import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pub } from "@irishpub-map/shared";
import PubDetailScreen from "../../apps/mobile/app/pub/[id]";
import { isSafeExternalUrl, openExternalUrl } from "../../apps/mobile/app/pub-links";

const { getPubs, linking, params } = vi.hoisted(() => ({
  getPubs: vi.fn(),
  linking: { canOpenURL: vi.fn(), openURL: vi.fn() },
  params: { id: "00000000-0000-4000-8000-000000000001", locale: "ja" },
}));

vi.mock("@irishpub-map/api-client", () => ({ getPubs }));
vi.mock("../../apps/mobile/app/router", () => ({
  useLocalSearchParams: () => params,
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    ActivityIndicator: () => React.createElement("span", { role: "progressbar" }),
    Linking: linking,
    Pressable: ({
      children,
      onPress,
      accessibilityRole,
      ...props
    }: React.ComponentProps<"button"> & {
      onPress?: () => void;
      accessibilityRole?: string;
    }) =>
      React.createElement("button", { ...props, type: "button", role: accessibilityRole, onClick: onPress }, children),
    ScrollView: ({ children }: React.PropsWithChildren) => React.createElement("main", null, children),
    Text: ({ children, accessibilityRole, ...props }: React.ComponentProps<"span"> & { accessibilityRole?: string }) =>
      React.createElement("span", { ...props, role: accessibilityRole }, children),
    View: ({ children, accessibilityRole }: React.PropsWithChildren<{ accessibilityRole?: string }>) =>
      React.createElement("div", { role: accessibilityRole }, children),
  };
});

const pub: Pub = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "The Green Harp",
  prefecture: "東京都",
  city: "渋谷区",
  address: "Tokyo",
  latitude: 35.68,
  longitude: 139.76,
  websiteUrl: "https://example.com",
  googleMapsUrl: "http://maps.example.com/pub",
  instagramUrl: "javascript:alert(1)",
  tags: ["food"],
  status: "open",
  pubType: "irish",
};

describe("Mobile pub detail and external links", () => {
  beforeEach(() => {
    params.id = "00000000-0000-4000-8000-000000000001";
    params.locale = "ja";
    getPubs.mockReset().mockResolvedValue([pub]);
    linking.canOpenURL.mockReset().mockResolvedValue(true);
    linking.openURL.mockReset().mockResolvedValue(undefined);
  });

  it("shows pub information and only safe external actions", async () => {
    render(<PubDetailScreen />);

    expect(await screen.findByText("The Green Harp")).toBeTruthy();
    expect(screen.getByText("都道府県: 東京都")).toBeTruthy();
    expect(screen.getByText("市区町村: 渋谷区")).toBeTruthy();
    expect(screen.getByRole("link", { name: "ウェブサイトを開く" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Google Mapsで開く" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Instagramを開く" })).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "ウェブサイトを開く" }));
    expect(linking.canOpenURL).toHaveBeenCalledWith("https://example.com");
    await waitFor(() => expect(linking.openURL).toHaveBeenCalledWith("https://example.com"));
  });

  it("handles an invalid or missing pub id without requesting data", async () => {
    params.id = "not-a-uuid";
    render(<PubDetailScreen />);
    expect(await screen.findByText("このパブは見つかりませんでした。")).toBeTruthy();
    expect(getPubs).not.toHaveBeenCalled();
  });

  it("omits absent optional fields and external actions", async () => {
    getPubs.mockResolvedValueOnce([
      { ...pub, city: null, websiteUrl: null, googleMapsUrl: null, instagramUrl: null, tags: [] },
    ]);
    render(<PubDetailScreen />);

    expect(await screen.findByText("The Green Harp")).toBeTruthy();
    expect(screen.queryByText(/市区町村:/)).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText("タグ")).toBeNull();
  });

  it("rejects unsupported schemes and safely handles canOpenURL and openURL failures", async () => {
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("file:///tmp/example")).toBe(false);
    expect(await openExternalUrl("javascript:alert(1)")).toBe(false);
    expect(linking.canOpenURL).not.toHaveBeenCalled();

    linking.canOpenURL.mockResolvedValueOnce(false);
    expect(await openExternalUrl("https://example.com")).toBe(false);
    linking.openURL.mockRejectedValueOnce(new Error("device failure"));
    expect(await openExternalUrl("https://example.com")).toBe(false);
  });
});
