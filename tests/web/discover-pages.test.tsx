import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
type GuideMetadata = {
  slug: string;
  kind: "guide";
  title: string;
  summary: string;
  category: "culture" | "pub-culture";
  tags: readonly string[];
  publishedAt: string;
};

const pageMocks = vi.hoisted(() => ({
  getRequestLocale: vi.fn(),
  listLegacyGuides: vi.fn(),
  loadLegacyGuide: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: pageMocks.getRequestLocale }));
vi.mock("../../apps/web/app/lib/content/legacy-repository", () => ({
  listLegacyGuides: pageMocks.listLegacyGuides,
  loadLegacyGuide: pageMocks.loadLegacyGuide,
}));
vi.mock("next/navigation", () => ({ notFound: pageMocks.notFound }));

import ContentLayout from "../../apps/web/app/(content)/layout";
import DiscoverPage, { generateMetadata as generateDiscoverMetadata } from "../../apps/web/app/(content)/discover/page";
import GuidePage, {
  generateMetadata as generateGuideMetadata,
} from "../../apps/web/app/(content)/discover/guides/[slug]/page";
import QuizPage, { generateMetadata as generateQuizMetadata } from "../../apps/web/app/(content)/discover/quiz/page";

const metadataByLocale = {
  ja: {
    slug: "sample",
    kind: "guide",
    title: "サンプルガイド",
    summary: "Explore Irelandセクション用のサンプルコンテンツです。",
    category: "culture",
    tags: ["sample"],
    publishedAt: "2026-09-02",
  },
  en: {
    slug: "sample",
    kind: "guide",
    title: "Sample Guide",
    summary: "Sample content for the Explore Ireland section.",
    category: "culture",
    tags: ["sample"],
    publishedAt: "2026-09-02",
  },
} satisfies Record<"ja" | "en", GuideMetadata>;

const splitTheGMetadataByLocale = {
  ja: {
    slug: "split-the-g",
    kind: "guide",
    title: "Split the Gを楽しむ",
    summary: "Guinnessのグラスを使ったPubの遊び「Split the G」を、安全に楽しむためのガイドです。",
    category: "pub-culture",
    tags: ["split-the-g", "guinness"],
    publishedAt: "2026-09-05",
  },
  en: {
    slug: "split-the-g",
    kind: "guide",
    title: "How to Enjoy Split the G",
    summary: "A guide to enjoying the pub game Split the G with a Guinness glass, safely and at your own pace.",
    category: "pub-culture",
    tags: ["split-the-g", "guinness"],
    publishedAt: "2026-09-05",
  },
} satisfies Record<"ja" | "en", GuideMetadata>;

let locale: "ja" | "en" = "ja";

beforeEach(() => {
  locale = "ja";
  pageMocks.getRequestLocale.mockReset().mockImplementation(() => Promise.resolve(locale));
  pageMocks.listLegacyGuides
    .mockReset()
    .mockImplementation((contentLocale: "ja" | "en") =>
      Promise.resolve([splitTheGMetadataByLocale[contentLocale], metadataByLocale[contentLocale]]),
    );
  pageMocks.loadLegacyGuide.mockReset().mockImplementation((slug, contentLocale: "ja" | "en") => {
    if (slug === "sample") {
      const GuideContent = () => (
        <p>{contentLocale === "ja" ? "コンテンツは後日追加予定です。" : "Content will be added later."}</p>
      );
      return Promise.resolve({ Component: GuideContent, metadata: metadataByLocale[contentLocale] });
    }
    if (slug === "split-the-g") {
      const GuideContent = () => (
        <>
          <p>{contentLocale === "ja" ? "地域によって判定方法は異なります。" : "How the result is judged varies."}</p>
          <a href="/">{contentLocale === "ja" ? "Irish Pubを探す →" : "Find an Irish pub →"}</a>
        </>
      );
      return Promise.resolve({ Component: GuideContent, metadata: splitTheGMetadataByLocale[contentLocale] });
    }
    return Promise.resolve(null);
  });
  pageMocks.notFound.mockReset().mockImplementation(() => {
    throw new Error("not-found");
  });
});

describe("Discover pages", () => {
  it("HubでStories placeholderと既存MDX Guide、Quizへの導線を表示する", async () => {
    render(await DiscoverPage());

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Explore Ireland" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Stories" })).toBeInTheDocument();
    expect(screen.getByText("準備中")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ガイドを読む: Split the Gを楽しむ" })).toHaveAttribute(
      "href",
      "/discover/guides/split-the-g",
    );
    expect(screen.getByRole("link", { name: "ガイドを読む: サンプルガイド" })).toHaveAttribute(
      "href",
      "/discover/guides/sample",
    );
    expect(screen.getByRole("link", { name: "今日のクイズに挑戦" })).toHaveAttribute("href", "/discover/quiz");
    expect(screen.getByRole("link", { name: "カレンダーを見る" })).toHaveAttribute("href", "/discover/calendar");
    expect(screen.getByRole("link", { name: "地図でIrish Pubを探す" })).toHaveAttribute("href", "/");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("Content LayoutがHeader、単一main、通常Footerと共通Navigationを提供する", async () => {
    render(await ContentLayout({ children: <section>Content body</section> }));

    expect(screen.getByRole("link", { name: "Irish Pub Map" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Explore Ireland" })).toHaveAttribute("href", "/discover");
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveClass("content-main");
    expect(screen.getByRole("contentinfo", { name: "アプリのバージョン情報" })).not.toHaveClass("app-version-compact");
    expect(screen.queryByLabelText("Irish Pub の地図と一覧")).not.toBeInTheDocument();
  });

  it("GuideをLocale別に表示し、H1、パンくず、関連導線を持つ", async () => {
    const { unmount } = render(await GuidePage({ params: Promise.resolve({ slug: "sample" }) }));

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "サンプルガイド" })).toBeInTheDocument();
    expect(screen.getByText("コンテンツは後日追加予定です。")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "現在位置" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore Ireland" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("heading", { level: 2, name: "次にExploreする" })).toBeInTheDocument();

    unmount();
    locale = "en";
    render(await GuidePage({ params: Promise.resolve({ slug: "sample" }) }));
    expect(screen.getByRole("heading", { level: 1, name: "Sample Guide" })).toBeInTheDocument();
    expect(screen.getByText("Content will be added later.")).toBeInTheDocument();
  });

  it("Split the GをLocale別に表示し、Mapへの導線を持つ", async () => {
    const { unmount } = render(await GuidePage({ params: Promise.resolve({ slug: "split-the-g" }) }));

    expect(screen.getByRole("heading", { level: 1, name: "Split the Gを楽しむ" })).toBeInTheDocument();
    expect(screen.getByText("地域によって判定方法は異なります。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Irish Pubを探す →" })).toHaveAttribute("href", "/");

    unmount();
    locale = "en";
    render(await GuidePage({ params: Promise.resolve({ slug: "split-the-g" }) }));
    expect(screen.getByRole("heading", { level: 1, name: "How to Enjoy Split the G" })).toBeInTheDocument();
    expect(screen.getByText("How the result is judged varies.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find an Irish pub →" })).toHaveAttribute("href", "/");
  });

  it("未登録Guideを404として扱う", async () => {
    await expect(GuidePage({ params: Promise.resolve({ slug: "unknown" }) })).rejects.toThrow("not-found");
    await expect(generateGuideMetadata({ params: Promise.resolve({ slug: "unknown" }) })).rejects.toThrow("not-found");
  });

  it("QuizはLocale別の今日の1問と4択、パンくずを表示する", async () => {
    locale = "en";
    render(await QuizPage());

    expect(screen.getByRole("heading", { level: 1, name: "Today's Ireland Quiz" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Choose one answer" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Submit answer" })).toBeDisabled();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore Ireland" })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: "View: Irish Pub Map" })).toHaveAttribute("href", "/");
  });

  it("各ページのMetadataをLocaleとGuide metadataから生成する", async () => {
    await expect(generateDiscoverMetadata()).resolves.toMatchObject({
      title: "Explore Ireland | Irish Pub Map",
    });
    await expect(generateGuideMetadata({ params: Promise.resolve({ slug: "sample" }) })).resolves.toEqual({
      title: "サンプルガイド | Irish Pub Map",
      description: metadataByLocale.ja.summary,
    });

    locale = "en";
    await expect(generateQuizMetadata()).resolves.toMatchObject({
      title: "Today's Ireland Quiz | Irish Pub Map",
      description: "Learn something new about Irish culture, history, and pub traditions with today's question.",
    });
  });
});
