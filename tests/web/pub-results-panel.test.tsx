// Results Panelの表示切替、店舗詳細、キーボード操作、選択店舗の追従を保証するテストです。
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PubResultsPanel } from "../../apps/web/app/components/pub-results-panel";
import { getTranslation } from "../../apps/web/app/lib/i18n";
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
    instagramUrl: "javascript:alert(1)",
    tags: ["guinness", "food", "live-music"],
    status: "open",
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
    tags: [],
    status: "unknown",
  },
];

const labels = getTranslation("ja").list;

function renderPanel(overrides: Partial<ComponentProps<typeof PubResultsPanel>> = {}) {
  const props: ComponentProps<typeof PubResultsPanel> = {
    pubs,
    selectedPubId: null,
    view: "list",
    locale: "ja",
    closeLabel: labels.closeResults,
    backLabel: labels.backToResults,
    panelLabel: labels.heading,
    emptyLabel: labels.noResults,
    emptyDescription: labels.noResultsDescription,
    onClose: vi.fn(),
    onSelectPub: vi.fn(),
    onShowDetails: vi.fn(),
    onBackToList: vi.fn(),
    ...overrides,
  };

  return render(<PubResultsPanel {...props} />);
}

describe("PubResultsPanel", () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("renders compact results and an empty state", () => {
    renderPanel();

    expect(screen.getByRole("complementary", { name: "掲載店舗" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "店舗を選択: Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "店舗を選択: Osaka Sample Pub" })).toBeInTheDocument();

    renderPanel({ pubs: [] });
    expect(screen.getByRole("status")).toHaveTextContent("該当するPubがありません");
    expect(screen.getByText("検索語や条件を変えてお試しください。")).toBeInTheDocument();
  });

  it("scrolls the selected result into view without changing focus", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    renderPanel({ selectedPubId: "osaka-sample" });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(document.body).toHaveFocus();
  });

  it("opens detail view, filters unsafe links, and returns to the result list", () => {
    const onBackToList = vi.fn();
    renderPanel({ selectedPubId: "tokyo-sample", view: "detail", onBackToList });

    expect(screen.getByRole("heading", { level: 3, name: "Tokyo Sample Pub" })).toBeInTheDocument();
    expect(screen.getByText("東京都千代田区1-1-1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tokyo Sample Pub の公式サイトを新しいタブで開く" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(
      screen.queryByRole("link", { name: "Tokyo Sample Pub のInstagramを新しいタブで開く" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /結果一覧に戻る/ }));
    expect(onBackToList).toHaveBeenCalledOnce();
  });

  it("closes from the close button and Escape", () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "結果一覧を閉じる" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
