// 共通Primitiveの操作・ラベル・任意情報と、複合部品へのref伝播を保証します。
import { createRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button, IconButton } from "../../apps/web/app/components/ui/button";
import { Icon } from "../../apps/web/app/components/ui/ui-icon";
import { Input } from "../../apps/web/app/components/ui/input";
import { Search } from "../../apps/web/app/components/ui/search";
import { FilterChip, FilterChipGroup } from "../../apps/web/app/components/ui/filter-chip";
import { StatusBadge } from "../../apps/web/app/components/ui/status-badge";
import { PubCard } from "../../apps/web/app/components/ui/pub-card";
import { ContentCard } from "../../apps/web/app/components/ui/content-card";
import { MapControl } from "../../apps/web/app/components/ui/map-control";
import {
  BrandLink,
  NavigationLink,
  HeaderAction,
  HeaderIconButton,
} from "../../apps/web/app/components/ui/header-primitives";
import type { Pub } from "../../packages/shared/src/pub";

const pub: Pub = {
  id: "sample",
  name: "長い店舗名 Very Long Pub Name",
  prefecture: "東京都",
  address: "東京都",
  latitude: 35,
  longitude: 139,
  tags: [],
  status: "unknown",
};

describe("Public UI primitives", () => {
  it.each(["primary", "secondary", "ghost", "destructive"] as const)(
    "supports %s, native attributes, focus refs and loading without losing the label",
    (variant) => {
      const click = vi.fn();
      const ref = createRef<HTMLButtonElement>();
      const { rerender } = render(
        <Button ref={ref} variant={variant} onClick={click}>
          探す
        </Button>,
      );
      expect(ref.current).toBe(screen.getByRole("button", { name: "探す" }));
      expect(ref.current).toHaveAttribute("type", "button");
      fireEvent.click(ref.current!);
      expect(click).toHaveBeenCalledOnce();
      rerender(
        <Button ref={ref} variant={variant} loading loadingLabel="検索中" onClick={click}>
          探す
        </Button>,
      );
      expect(ref.current).toBeDisabled();
      expect(ref.current).toHaveAttribute("aria-busy", "true");
      expect(ref.current).toHaveAccessibleName("探す");
      expect(screen.getByRole("status")).toHaveTextContent("検索中");
      fireEvent.click(ref.current!);
      expect(click).toHaveBeenCalledOnce();
      rerender(
        <Button type="submit" disabled>
          送信
        </Button>,
      );
      expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
      expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
    },
  );

  it("requires an accessible icon label and hides decorative paths", () => {
    const { rerender } = render(
      <IconButton label="閉じる">
        <Icon name="close" />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "閉じる" })).toHaveAttribute("title", "閉じる");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    rerender(
      <IconButton label="検索" title="店舗検索" variant="secondary" className="custom">
        <Icon name="search" />
      </IconButton>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("title", "店舗検索");
    expect(screen.getByRole("button")).toHaveClass("custom");
  });

  it("associates unique labels and errors while preserving existing descriptions and refs", () => {
    const ref = createRef<HTMLInputElement>();
    const { rerender } = render(
      <>
        <p id="help">入力の説明</p>
        <Input ref={ref} label="店舗名" error="必須です" aria-describedby="help" />
        <Input label="地域" />
      </>,
    );
    expect(ref.current).toBe(screen.getByLabelText("店舗名"));
    expect(ref.current).toHaveAccessibleDescription("入力の説明 必須です");
    expect(ref.current).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("地域").id).not.toBe(ref.current!.id);
    rerender(<Input ref={ref} id="named" label="店舗名" hideLabel readOnly value="Pub" aria-invalid="true" />);
    expect(ref.current).toHaveAttribute("readonly");
    expect(ref.current).toHaveAttribute("id", "named");
    expect(ref.current).toHaveAttribute("aria-invalid", "true");
    expect(ref.current).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears controlled search and returns focus to the input", () => {
    function Demo() {
      const [value, setValue] = useState("");
      return <Search label="検索" clearLabel="クリア" value={value} onValueChange={setValue} />;
    }
    render(<Demo />);
    const input = screen.getByRole("searchbox", { name: "検索" });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "東京" } });
    fireEvent.click(screen.getByRole("button", { name: "クリア" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each(["disabled", "readOnly"] as const)("does not clear a %s search", (state) => {
    const change = vi.fn();
    render(
      <Search
        label="検索"
        hideLabel={false}
        clearLabel="クリア"
        value="Tokyo"
        onValueChange={change}
        {...{ [state]: true }}
      />,
    );
    expect(screen.getByRole("button")).toBeDisabled();
    fireEvent.click(screen.getByRole("button"));
    expect(change).not.toHaveBeenCalled();
  });

  it("publishes selection and disabled state for chips inside a named scroll group", () => {
    const toggle = vi.fn();
    const { rerender } = render(
      <FilterChipGroup label="特徴">
        <FilterChip onClick={toggle}>ビール</FilterChip>
      </FilterChipGroup>,
    );
    expect(screen.getByRole("group", { name: "特徴" })).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button"));
    expect(toggle).toHaveBeenCalledOnce();
    rerender(
      <FilterChip selected disabled onClick={toggle}>
        ビール
      </FilterChip>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button"));
    expect(toggle).toHaveBeenCalledOnce();
  });

  it.each(["open", "closed", "temporarily_closed", "unknown"] as const)("shows a text status for %s", (status) => {
    render(<StatusBadge status={status} label={`営業状態: ${status}`} />);
    expect(screen.getByText(`営業状態: ${status}`)).toHaveAttribute("data-status", status);
  });

  it("preserves card selection refs, optional information and separate detail actions", () => {
    const select = vi.fn();
    const details = vi.fn();
    const ref = createRef<HTMLElement>();
    const { rerender } = render(<PubCard ref={ref} pub={pub} onSelect={select} />);
    expect(ref.current).toBe(screen.getByRole("article"));
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(select).toHaveBeenCalledWith("sample");
    rerender(
      <PubCard
        pub={{ ...pub, tags: ["craft-beer"] }}
        locale="en"
        selected
        onSelect={select}
        onShowDetails={details}
        media={<span>写真</span>}
        metadata="駅の近く"
        distance="320 m"
      />,
    );
    expect(screen.getByRole("article")).toHaveAttribute("data-selected", "true");
    expect(screen.getByText("写真")).toBeInTheDocument();
    expect(screen.getByText("駅の近く")).toBeInTheDocument();
    expect(screen.getByText("320 m")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(details).toHaveBeenCalledWith("sample");
    expect(select).toHaveBeenCalledOnce();
  });

  it("keeps editorial content and optional slots separate from pub selection", () => {
    const { rerender } = render(<ContentCard titleId="guide" title="ガイド" />);
    expect(screen.getByRole("region", { name: "ガイド" })).toHaveAttribute("data-variant", "default");
    rerender(
      <ContentCard
        titleId="guide"
        title="ガイド"
        variant="feature"
        media={<span>写真</span>}
        eyebrow="Ireland"
        description="説明"
        metadata="5分"
        action={<a href="/discover">読む</a>}
      >
        <p>補足</p>
      </ContentCard>,
    );
    expect(screen.getByRole("region")).toHaveAttribute("data-variant", "feature");
    for (const text of ["写真", "Ireland", "説明", "5分", "補足"]) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "読む" })).toHaveAttribute("href", "/discover");
  });

  it("shares button behavior for map and header and exposes current navigation", () => {
    const click = vi.fn();
    render(
      <>
        <MapControl label="現在地" onClick={click}>
          <Icon name="location" />
        </MapControl>
        <HeaderIconButton label="メニュー" onClick={click}>
          <Icon name="menu" />
        </HeaderIconButton>
        <HeaderAction onClick={click}>言語</HeaderAction>
        <BrandLink href="/">Irish Pub Map</BrandLink>
        <NavigationLink href="/discover" current>
          Discover
        </NavigationLink>
        <NavigationLink href="/">Map</NavigationLink>
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "現在地" }));
    fireEvent.click(screen.getByRole("button", { name: "メニュー" }));
    fireEvent.click(screen.getByRole("button", { name: "言語" }));
    expect(click).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Map" })).not.toHaveAttribute("aria-current");
  });
});
