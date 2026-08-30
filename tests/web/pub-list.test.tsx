// 結果Panel内で使うコンパクトな店舗カードの表示と操作を保証するテストです。
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
    instagramUrl: "https://instagram.example.com/tokyo",
    tags: ["guinness", "live-music", "seasonal-event"],
    tagDisplayNames: { guinness: "Guinness", "live-music": "Live music" },
    status: "open",
    statusDisplayName: "Open",
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
    status: "unknown",
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
    status: "closed",
  },
];

describe("PubList", () => {
  it("renders the result count and compact pub cards", () => {
    render(<PubList pubs={pubs} />);

    expect(screen.getByRole("heading", { name: "掲載店舗" })).toBeInTheDocument();
    expect(screen.getByText("3件")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.getByText("東京都 / 千代田区")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Osaka Sample Pub" })).toBeInTheDocument();
    expect(screen.getByText("大阪府")).toBeInTheDocument();
  });

  it("shows status, at most two tags, and an additional tag count", () => {
    render(<PubList pubs={pubs} />);

    const cards = screen.getAllByRole("article");
    expect(within(cards[0]).getByText("Open")).toHaveClass("pub-status-open");
    expect(within(cards[0]).getByRole("list", { name: "Tokyo Sample Pub のタグ" })).toHaveTextContent("Guinness");
    expect(within(cards[0]).getByRole("list", { name: "Tokyo Sample Pub のタグ" })).toHaveTextContent("Live music");
    expect(within(cards[0]).getByRole("list", { name: "Tokyo Sample Pub のタグ" })).toHaveTextContent("+1");
    expect(within(cards[0]).queryByText("seasonal-event")).not.toBeInTheDocument();
    expect(within(cards[1]).getByText("不明")).toHaveClass("pub-status-unknown");
    expect(within(cards[1]).queryByRole("list")).not.toBeInTheDocument();
    expect(within(cards[2]).getByText("閉業")).toHaveClass("pub-status-closed");
    expect(cards[2]).toHaveClass("pub-card", "pub-card-closed");
  });

  it("selects a card with a real button and reflects the selected state", () => {
    const onSelectPub = vi.fn();
    const { rerender } = render(<PubList pubs={pubs} onSelectPub={onSelectPub} />);

    const selectButton = screen.getByRole("button", { name: "店舗を選択: Tokyo Sample Pub" });
    expect(selectButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(selectButton);
    expect(onSelectPub).toHaveBeenCalledWith("tokyo-sample");

    rerender(<PubList pubs={pubs} selectedPubId="tokyo-sample" onSelectPub={onSelectPub} />);
    expect(screen.getByRole("button", { name: "店舗を選択: Tokyo Sample Pub" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByRole("article")[0]).toHaveClass("pub-card-selected");
  });

  it("delegates detail navigation separately from card selection", () => {
    const onSelectPub = vi.fn();
    const onShowDetails = vi.fn();
    render(<PubList pubs={pubs} onSelectPub={onSelectPub} onShowDetails={onShowDetails} />);

    fireEvent.click(screen.getAllByRole("button", { name: "詳細" })[0]);

    expect(onShowDetails).toHaveBeenCalledWith("tokyo-sample");
    expect(onSelectPub).not.toHaveBeenCalled();
  });

  it("does not render external links in compact result cards", () => {
    render(<PubList pubs={pubs} onShowDetails={() => undefined} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "詳細" })).toHaveLength(3);
  });
});
