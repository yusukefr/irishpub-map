import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pub } from "@irishpub-map/shared";
import HomeScreen, { resolveInitialLocale } from "../../apps/mobile/app/index";

const { getPubs } = vi.hoisted(() => ({ getPubs: vi.fn() }));

vi.mock("@irishpub-map/api-client", () => ({ getPubs }));
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    ActivityIndicator: () => React.createElement("span", { role: "progressbar" }),
    Pressable: ({
      children,
      onPress,
      accessibilityRole,
      accessibilityState,
      ...props
    }: React.ComponentProps<"button"> & {
      onPress?: () => void;
      accessibilityRole?: string;
      accessibilityState?: { selected?: boolean };
    }) => React.createElement("button", { ...props, type: "button", onClick: onPress }, children),
    ScrollView: ({ children }: React.PropsWithChildren) => React.createElement("main", null, children),
    Text: ({
      children,
      accessibilityRole,
      ...props
    }: React.ComponentProps<"span"> & {
      accessibilityRole?: string;
    }) =>
      React.createElement("span", { ...props, role: accessibilityRole === "alert" ? "alert" : undefined }, children),
    View: ({ children }: React.PropsWithChildren) => React.createElement("div", null, children),
  };
});

const pub: Pub = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "The Green Harp",
  prefecture: "東京都",
  address: "Tokyo",
  latitude: 35.68,
  longitude: 139.76,
  tags: [],
  status: "open",
  pubType: "irish",
};

describe("Mobile Pub list screen", () => {
  beforeEach(() => {
    getPubs.mockReset();
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      locale: "ja-JP",
    } as Intl.ResolvedDateTimeFormatOptions);
  });
  afterEach(() => vi.restoreAllMocks());

  it("falls back to Japanese for unsupported device locales", () => {
    expect(resolveInitialLocale("fr-FR")).toBe("ja");
    expect(resolveInitialLocale("en-US")).toBe("en");
  });

  it("shows loading and renders the fetched Pub summary", async () => {
    let resolvePubs: ((pubs: Pub[]) => void) | undefined;
    getPubs.mockImplementation(() => new Promise((resolve) => (resolvePubs = resolve)));

    render(<HomeScreen />);
    expect(screen.getByText("パブ一覧を読み込んでいます…")).toBeTruthy();
    resolvePubs?.([pub]);

    expect(await screen.findByText("1 件のパブ")).toBeTruthy();
    expect(screen.getByText("The Green Harp")).toBeTruthy();
    expect(screen.getByText("都道府県: 東京都")).toBeTruthy();
    expect(screen.getByText("営業状況: 営業中")).toBeTruthy();
    expect(getPubs).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "ja", baseUrl: expect.any(String), signal: expect.any(AbortSignal) }),
    );
  });

  it("uses the selected locale for API requests and screen labels", async () => {
    getPubs.mockResolvedValue([pub]);
    render(<HomeScreen />);
    await screen.findByText("1 件のパブ");

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    await waitFor(() =>
      expect(getPubs).toHaveBeenLastCalledWith(
        expect.objectContaining({ locale: "en", signal: expect.any(AbortSignal) }),
      ),
    );
    expect(await screen.findByText("1 pubs")).toBeTruthy();
    expect(screen.getByText("Status: Open")).toBeTruthy();
  });

  it("cancels an outstanding request when the screen unmounts", () => {
    getPubs.mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<HomeScreen />);
    const signal = getPubs.mock.calls[0]?.[0].signal as AbortSignal;

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it("hides request details and retries after an error", async () => {
    getPubs.mockRejectedValueOnce(new Error("internal response body"));
    getPubs.mockResolvedValueOnce([pub]);
    render(<HomeScreen />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "パブ一覧を読み込めませんでした。通信状況を確認して、もう一度お試しください。",
    );
    expect(screen.queryByText("internal response body")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));

    expect(await screen.findByText("1 件のパブ")).toBeTruthy();
    expect(getPubs).toHaveBeenCalledTimes(2);
  });
});
