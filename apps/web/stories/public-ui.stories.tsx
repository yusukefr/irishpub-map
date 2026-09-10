import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { Pub } from "@irishpub-map/shared/pub";
import { Button, IconButton } from "../app/components/ui/button";
import { Icon } from "../app/components/ui/ui-icon";
import { Input } from "../app/components/ui/input";
import { Search } from "../app/components/ui/search";
import { FilterChip, FilterChipGroup } from "../app/components/ui/filter-chip";
import { StatusBadge } from "../app/components/ui/status-badge";
import { PubCard } from "../app/components/ui/pub-card";
import { ContentCard } from "../app/components/ui/content-card";
import { MapControl } from "../app/components/ui/map-control";
import { BottomSheet, type BottomSheetState } from "../app/components/ui/bottom-sheet";
import { BrandLink, NavigationLink, HeaderIconButton } from "../app/components/ui/header-primitives";
import { LanguageSwitcher } from "../app/components/language-switcher";
import { getTranslation, type Locale } from "../app/lib/i18n";
import styles from "./public-ui.module.css";

const samplePub: Pub = {
  id: "story-pub",
  name: "The Local Pub",
  prefecture: "東京都",
  city: "千代田区",
  address: "東京都千代田区",
  latitude: 35.68,
  longitude: 139.76,
  tags: ["guinness", "craft-beer", "live-music", "sports"],
  status: "open",
};

// 実店舗の写真ではなく、media slotの寸法・代替テキストを確認する図です。
function Media() {
  return (
    <svg role="img" aria-label="Photo placeholder" viewBox="0 0 640 360" className={styles.media}>
      <rect width="640" height="360" fill="var(--color-brand-soft)" />
      <path d="M0 360 220 120 360 260 460 170 640 360Z" fill="var(--color-brand-primary)" />
    </svg>
  );
}

function Buttons({ locale }: { locale: Locale }) {
  const [loading, setLoading] = useState(false);
  const label = locale === "ja" ? "パブを探す" : "Find pubs";
  return (
    <section className={styles.section} aria-label="Button">
      <h2>Button / Icon Button</h2>
      <div className={styles.row}>
        {(["primary", "secondary", "ghost", "destructive"] as const).map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}: {label}
          </Button>
        ))}
      </div>
      <div className={styles.row}>
        <Button disabled>{locale === "ja" ? "利用できません" : "Unavailable"}</Button>
        <Button loading loadingLabel={locale === "ja" ? "検索中" : "Searching"}>
          {label}
        </Button>
        <Button loading={loading} onClick={() => setLoading(true)} data-testid="loading-button">
          {locale === "ja" ? "読み込みを開始" : "Start loading"}
        </Button>
        <IconButton label={locale === "ja" ? "閉じる" : "Close"}>
          <Icon name="close" />
        </IconButton>
      </div>
      <Button variant="secondary">
        {locale === "ja"
          ? "選択した条件で、駅の近くにあるアイリッシュパブをもう一度探す"
          : "Search again for welcoming Irish pubs near the station using the selected filters"}
      </Button>
    </section>
  );
}

function SearchAndInputs({ locale }: { locale: Locale }) {
  const [value, setValue] = useState(locale === "ja" ? "東京駅の近く" : "Near Tokyo station");
  const t = getTranslation(locale);
  return (
    <section className={styles.section} aria-label="Search and Input">
      <h2>Search / Input</h2>
      <Search
        label={locale === "ja" ? "パブを探す" : "Find a pub"}
        value={value}
        onValueChange={setValue}
        clearLabel={locale === "ja" ? "検索をクリア" : "Clear search"}
        placeholder={locale === "ja" ? "エリア・駅名・店名" : "Area, station or pub"}
      />
      <Input label={locale === "ja" ? "店舗名" : "Pub name"} placeholder="The Local Pub" />
      <Input
        label={locale === "ja" ? "入力エラー" : "Input error"}
        error={
          locale === "ja"
            ? "店舗名を入力してください。長い日本語のエラーメッセージも折り返して表示します。"
            : "Enter a pub name. Long validation messages wrap without hiding the input label."
        }
      />
      <Input label={locale === "ja" ? "読み取り専用" : "Read only"} readOnly value={t.list.statuses.unknown} />
      <Input label={locale === "ja" ? "利用不可" : "Disabled"} disabled />
      <Search
        label={
          locale === "ja"
            ? "長いラベルの検索欄を表示して確認します"
            : "A longer visible search label for narrow screens"
        }
        hideLabel={false}
        value="Read-only search"
        readOnly
        onValueChange={() => undefined}
        clearLabel="Clear read-only search"
        error={locale === "ja" ? "検索条件を確認してください" : "Check the search criteria"}
      />
    </section>
  );
}

function Chips({ locale }: { locale: Locale }) {
  const [selected, setSelected] = useState(true);
  return (
    <section className={styles.section} aria-label="Filter Chip">
      <h2>Filter Chip / Status Badge</h2>
      <FilterChipGroup label={locale === "ja" ? "特徴で絞り込み" : "Filter by feature"}>
        <FilterChip selected={selected} onClick={() => setSelected(!selected)}>
          {locale === "ja" ? "クラフトビール" : "Craft beer"}
        </FilterChip>
        <FilterChip>
          {locale === "ja" ? "スポーツ観戦を楽しめるパブ" : "Pubs where you can enjoy live sports with friends"}
        </FilterChip>
        <FilterChip disabled>{locale === "ja" ? "現在地周辺" : "Nearby"}</FilterChip>
      </FilterChipGroup>
      <div className={styles.row}>
        {(["open", "closed", "temporarily_closed", "unknown"] as const).map((status) => (
          <StatusBadge key={status} status={status} label={getTranslation(locale).list.statuses[status]} />
        ))}
      </div>
    </section>
  );
}

function Pubs({ locale }: { locale: Locale }) {
  const [selected, setSelected] = useState("selected");
  const longName =
    locale === "ja"
      ? "東京駅から歩いて訪ねる音楽とクラフトビールを楽しめるアイリッシュパブ"
      : "The Very Long Irish Pub Name for Neighbours and Travellers near the Station";
  return (
    <section className={styles.section} aria-label="Pub Card">
      <h2>Pub Card</h2>
      <div className={styles.grid}>
        <PubCard
          pub={samplePub}
          locale={locale}
          selected={selected === samplePub.id}
          onSelect={setSelected}
          media={<Media />}
          metadata={locale === "ja" ? "駅から徒歩5分" : "5 minutes from the station"}
          distance="320 m"
          onShowDetails={() => undefined}
        />
        <PubCard
          pub={{ ...samplePub, id: "selected", name: longName }}
          locale={locale}
          selected={selected === "selected"}
          onSelect={setSelected}
          onShowDetails={() => undefined}
        />
        <PubCard
          pub={{ ...samplePub, id: "closed", name: "Closed Pub", status: "closed", tags: [] }}
          locale={locale}
          onSelect={setSelected}
        />
        <PubCard
          pub={{ ...samplePub, id: "missing", name: "Unknown Pub", status: "unknown", city: undefined, tags: [] }}
          locale={locale}
          onSelect={setSelected}
        />
      </div>
    </section>
  );
}

function Content({ locale }: { locale: Locale }) {
  const title =
    locale === "ja"
      ? "アイルランドのパブ文化と街を歩いて楽しむための長いガイドタイトル"
      : "A longer guide to discovering local Irish pub culture and exploring the neighbourhood";
  const description =
    locale === "ja"
      ? "街の歴史、人との出会い、音楽を楽しむためのヒントを紹介します。"
      : "Discover local history, welcoming places and music along the way.";
  return (
    <section className={styles.section} aria-label="Content Card">
      <h2>Content Card</h2>
      <div className={styles.grid}>
        {(["default", "image", "text-only", "feature", "compact"] as const).map((variant) => (
          <ContentCard
            key={variant}
            titleId={`story-${variant}`}
            variant={variant}
            title={title}
            description={description}
            eyebrow="Explore Ireland"
            media={variant === "image" ? <Media /> : undefined}
            metadata={locale === "ja" ? "5分で読めます" : "5 minute read"}
            action={<a href="#story-end">{locale === "ja" ? "ガイドを読む" : "Read the guide"}</a>}
          />
        ))}
      </div>
    </section>
  );
}

function MapAndSheet({ locale }: { locale: Locale }) {
  const [state, setState] = useState<BottomSheetState>("medium");
  const labels =
    locale === "ja"
      ? { collapsed: "折りたたみ", medium: "中間", expanded: "展開" }
      : { collapsed: "Collapsed", medium: "Medium", expanded: "Expanded" };
  return (
    <section className={styles.section} aria-label="Map Control and Bottom Sheet">
      <h2>Map Control / Bottom Sheet</h2>
      <div className={styles.row}>
        <MapControl label={locale === "ja" ? "拡大" : "Zoom in"}>
          <Icon name="plus" />
        </MapControl>
        <MapControl label={locale === "ja" ? "縮小" : "Zoom out"}>
          <Icon name="minus" />
        </MapControl>
        <MapControl label={locale === "ja" ? "現在地" : "Current location"}>
          <Icon name="location" />
        </MapControl>
        <MapControl label={locale === "ja" ? "表示をリセット" : "Reset view"}>
          <Icon name="search" />
        </MapControl>
      </div>
      <div className={styles.row}>
        {(["collapsed", "medium", "expanded"] as const).map((next) => (
          <Button key={next} variant="secondary" onClick={() => setState(next)}>
            {labels[next]}
          </Button>
        ))}
      </div>
      <BottomSheet
        state={state}
        onStateChange={setState}
        title={locale === "ja" ? "周辺のパブ" : "Nearby pubs"}
        resizeLabel={locale === "ja" ? "高さを変更" : "Resize sheet"}
        stateLabels={labels}
      >
        <Button onClick={() => setState("collapsed")}>{locale === "ja" ? "折りたたむ" : "Collapse sheet"}</Button>
        {Array.from({ length: 20 }, (_, index) => (
          <p key={index}>
            {locale === "ja" ? "スクロールして周辺のパブを確認します。" : "Scroll to explore nearby pubs."} {index + 1}
          </p>
        ))}
      </BottomSheet>
    </section>
  );
}

function CompactPubs({ locale }: { locale: Locale }) {
  const [selected, setSelected] = useState("compact-open");
  return (
    <section className={styles.compactPanel} aria-label="Desktop pub cards">
      {(["open", "temporarily_closed", "closed", "unknown"] as const).map((status) => {
        const pub = {
          ...samplePub,
          id: `compact-${status}`,
          status,
          name:
            locale === "ja"
              ? "駅前の長い名前を持つアイリッシュパブとミュージックハウス"
              : "The Welcoming Irish Pub and Traditional Music House Near the Station",
          prefecture: locale === "ja" ? "東京都" : "Tokyo",
          city: locale === "ja" ? "千代田区" : "Chiyoda station area",
        };
        return (
          <PubCard
            key={pub.id}
            pub={pub}
            locale={locale}
            density="compact"
            selected={selected === pub.id}
            onSelect={setSelected}
            onShowDetails={setSelected}
          />
        );
      })}
    </section>
  );
}

function Gallery({ locale = "ja", only = "all" }: { locale?: Locale; only?: string }) {
  return (
    <main className={styles.gallery} lang={locale}>
      <h1>Public UI Components</h1>
      {only === "all" ? (
        <header className={styles.header}>
          <BrandLink href="/">Irish Pub Map</BrandLink>
          <nav aria-label={locale === "ja" ? "メインナビゲーション" : "Main navigation"}>
            <NavigationLink href="/" current>
              Map
            </NavigationLink>
            <NavigationLink href="/discover">Discover</NavigationLink>
          </nav>
          <LanguageSwitcher locale={locale} />
          <HeaderIconButton label={locale === "ja" ? "メニュー" : "Menu"}>
            <Icon name="menu" />
          </HeaderIconButton>
        </header>
      ) : null}
      {only === "all" || only === "button" ? <Buttons locale={locale} /> : null}
      {only === "all" || only === "search" ? <SearchAndInputs locale={locale} /> : null}
      {only === "all" || only === "chip" ? <Chips locale={locale} /> : null}
      {only === "all" || only === "pub" ? <Pubs locale={locale} /> : null}
      {only === "compact-pub" ? <CompactPubs locale={locale} /> : null}
      {only === "all" || only === "content" ? <Content locale={locale} /> : null}
      {only === "all" || only === "sheet" ? <MapAndSheet locale={locale} /> : null}
      <p id="story-end">End of component examples</p>
    </main>
  );
}

const meta = {
  title: "Design System/Public UI",
  component: Gallery,
  parameters: { layout: "fullscreen", a11y: { test: "error" } },
  args: { locale: "ja", only: "all" },
  argTypes: { locale: { control: "radio", options: ["ja", "en"] }, only: { control: false } },
} satisfies Meta<typeof Gallery>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Japanese: Story = {};
export const English: Story = { args: { locale: "en" } };
export const ButtonStates: Story = { args: { only: "button" } };
export const SearchStates: Story = { args: { only: "search" } };
export const FilterChips: Story = { args: { only: "chip" } };
export const PubCards: Story = { args: { only: "pub" } };
export const DesktopPubCards: Story = { args: { only: "compact-pub" } };
export const DesktopPubCardsEnglish: Story = { args: { only: "compact-pub", locale: "en" } };
export const ContentCards: Story = { args: { only: "content" } };
export const BottomSheetStates: Story = { args: { only: "sheet" } };
export const Mobile: Story = {
  decorators: [
    (Story) => (
      <div className={styles.mobile}>
        <Story />
      </div>
    ),
  ],
};
