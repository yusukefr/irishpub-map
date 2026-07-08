import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PubList } from "../../apps/web/app/components/pub-list";
import type { Pub } from "../../packages/shared/src/pub";

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
    tags: ["guinness", "live-music"],
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
    id: "kyoto-temporary",
    name: "Kyoto Temporary Pub",
    prefecture: "京都府",
    city: "京都市",
    address: "京都府京都市1-1-1",
    latitude: 35.011,
    longitude: 135.768,
    websiteUrl: null,
    googleMapsUrl: null,
    instagramUrl: null,
    tags: ["food"],
    status: "temporarily_closed"
  },
  {
    id: "nagoya-closed",
    name: "Nagoya Closed Pub",
    prefecture: "愛知県",
    city: "名古屋市",
    address: "愛知県名古屋市1-1-1",
    latitude: 35.181,
    longitude: 136.906,
    websiteUrl: null,
    googleMapsUrl: null,
    instagramUrl: null,
    tags: ["craft-beer"],
    status: "closed"
  }
];

describe("PubList", () => {
  it("renders pub count and pub locations", () => {
    render(<PubList pubs={pubs} />);

    expect(screen.getByRole("heading", { name: "掲載店舗" })).toBeInTheDocument();
    expect(screen.getByText("4件")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.getByText("東京都 / 千代田区")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Osaka Sample Pub" })).toBeInTheDocument();
    expect(screen.getByText("大阪府")).toBeInTheDocument();
  });

  it("renders pub status labels and tags", () => {
    render(<PubList pubs={pubs} />);

    const cards = screen.getAllByRole("article");
    expect(within(cards[0]).getByText("営業中")).toHaveClass("pub-status-open");
    expect(within(cards[0]).getByRole("list", { name: "Tokyo Sample Pub tags" })).toHaveTextContent("guinness");
    expect(within(cards[0]).getByRole("list", { name: "Tokyo Sample Pub tags" })).toHaveTextContent("live-music");
    expect(within(cards[1]).getByText("不明")).toHaveClass("pub-status-unknown");
    expect(within(cards[1]).queryByRole("list", { name: "Osaka Sample Pub tags" })).not.toBeInTheDocument();
    expect(within(cards[2]).getByText("一時休業")).toHaveClass("pub-status-temporarily-closed");
    expect(within(cards[2]).getByText("food")).toBeInTheDocument();
    expect(within(cards[3]).getByText("閉業")).toHaveClass("pub-status-closed");
    expect(within(cards[3]).getByText("craft-beer")).toBeInTheDocument();
    expect(cards[0]).not.toHaveClass("pub-card-closed");
    expect(cards[1]).not.toHaveClass("pub-card-closed");
    expect(cards[2]).not.toHaveClass("pub-card-closed");
    expect(cards[3]).toHaveClass("pub-card", "pub-card-closed");
  });

  it("renders external links only when URLs exist", () => {
    render(<PubList pubs={pubs} />);

    const cards = screen.getAllByRole("article");
    expect(within(cards[0]).getByRole("link", { name: "公式サイト" })).toHaveAttribute(
      "href",
      "https://example.com"
    );
    expect(within(cards[0]).getByRole("link", { name: "Google Maps" })).toHaveAttribute(
      "href",
      "https://maps.example.com"
    );
    expect(within(cards[1]).queryByRole("link", { name: "公式サイト" })).not.toBeInTheDocument();
    expect(within(cards[1]).queryByRole("link", { name: "Google Maps" })).not.toBeInTheDocument();
  });
});
