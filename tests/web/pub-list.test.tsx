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
    id: "kyoto-closed",
    name: "Kyoto Closed Pub",
    prefecture: "京都府",
    city: "京都市",
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

describe("PubList", () => {
  it("renders pub count and pub locations", () => {
    render(<PubList pubs={pubs} />);

    expect(screen.getByRole("heading", { name: "掲載店舗" })).toBeInTheDocument();
    expect(screen.getByText("3件")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.getByText("東京都 / 千代田区")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Osaka Sample Pub" })).toBeInTheDocument();
    expect(screen.getByText("大阪府")).toBeInTheDocument();
  });

  it("styles only closed pub cards as closed", () => {
    render(<PubList pubs={pubs} />);

    const cards = screen.getAllByRole("article");
    expect(cards[0]).toHaveClass("pub-card");
    expect(cards[0]).not.toHaveClass("pub-card-closed");
    expect(cards[1]).toHaveClass("pub-card");
    expect(cards[1]).not.toHaveClass("pub-card-closed");
    expect(cards[2]).toHaveClass("pub-card", "pub-card-closed");
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
