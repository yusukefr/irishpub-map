import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PubExplorer } from "../../apps/web/app/components/pub-explorer";
import type { Pub } from "../../packages/shared/src/pub";
import { resetMaplibreMock } from "../mocks/maplibre-gl";

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

function mockWebglContext() {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((contextId: string) => {
    if (contextId === "webgl" || contextId === "experimental-webgl") {
      return {} as never;
    }

    return null;
  });
}

describe("PubExplorer", () => {
  beforeEach(() => {
    resetMaplibreMock();
    mockWebglContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
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

  it("filters the displayed pubs by selected prefecture", () => {
    render(<PubExplorer pubs={pubs} />);

    expect(screen.getByRole("option", { name: "すべての都道府県" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "大阪府" } });

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Osaka Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tokyo Sample Pub" })).not.toBeInTheDocument();
  });

  it("filters the displayed pubs by tag", () => {
    render(<PubExplorer pubs={pubs} />);

    fireEvent.change(screen.getByLabelText("タグ"), { target: { value: "live-music" } });

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Osaka Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tokyo Sample Pub" })).not.toBeInTheDocument();
  });

  it("filters the displayed pubs by status", () => {
    render(<PubExplorer pubs={pubs} />);

    fireEvent.change(screen.getByLabelText("営業状況"), { target: { value: "closed" } });

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kyoto Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tokyo Sample Pub" })).not.toBeInTheDocument();
  });

  it("combines search, prefecture, tag, and status filters", () => {
    render(<PubExplorer pubs={pubs} />);

    fireEvent.change(screen.getByLabelText("店舗を検索"), { target: { value: "京都府" } });
    fireEvent.change(screen.getByLabelText("都道府県"), { target: { value: "京都府" } });
    fireEvent.change(screen.getByLabelText("タグ"), { target: { value: "food" } });
    fireEvent.change(screen.getByLabelText("営業状況"), { target: { value: "closed" } });

    expect(screen.getByText("1件のPubが見つかりました")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kyoto Sample Pub" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tokyo Sample Pub" })).not.toBeInTheDocument();
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
