import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
type GuideContent = {
  slug: string;
  kind: "guide";
  title: string;
  summary: string;
  category: "culture" | "pub-culture";
  publishedAt: string;
  bodyMarkdown: string;
};
type StoryContent = Omit<GuideContent, "kind"> & { kind: "story" };

const pageMocks = vi.hoisted(() => ({
  getRequestLocale: vi.fn(),
  listPublishedContent: vi.fn(),
  getPublishedContentBySlug: vi.fn(),
  getDailyPublishedQuiz: vi.fn(),
  isDataSourceConfigured: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: pageMocks.getRequestLocale }));
vi.mock("../../apps/web/app/lib/content/repository", () => ({
  listPublishedContent: pageMocks.listPublishedContent,
  getPublishedContentBySlug: pageMocks.getPublishedContentBySlug,
}));
vi.mock("../../apps/web/app/lib/e2e-test-mode", () => ({
  isDataSourceConfigured: pageMocks.isDataSourceConfigured,
}));
vi.mock("../../apps/web/app/lib/quiz/repository", () => ({
  getDailyPublishedQuiz: pageMocks.getDailyPublishedQuiz,
}));
vi.mock("next/navigation", () => ({ notFound: pageMocks.notFound }));

import ContentLayout from "../../apps/web/app/(content)/layout";
import DiscoverPage, { generateMetadata as generateDiscoverMetadata } from "../../apps/web/app/(content)/discover/page";
import GuidePage, {
  generateMetadata as generateGuideMetadata,
} from "../../apps/web/app/(content)/discover/guides/[slug]/page";
import StoryPage, {
  generateMetadata as generateStoryMetadata,
} from "../../apps/web/app/(content)/discover/stories/[slug]/page";
import QuizPage, { generateMetadata as generateQuizMetadata } from "../../apps/web/app/(content)/discover/quiz/page";

const metadataByLocale = {
  ja: {
    slug: "sample",
    kind: "guide",
    title: "サンプルガイド",
    summary: "Explore Irelandセクション用のサンプルコンテンツです。",
    category: "culture",
    publishedAt: "2026-09-02T00:00:00.000Z",
    bodyMarkdown: "コンテンツは後日追加予定です。",
  },
  en: {
    slug: "sample",
    kind: "guide",
    title: "Sample Guide",
    summary: "Sample content for the Explore Ireland section.",
    category: "culture",
    publishedAt: "2026-09-02T00:00:00.000Z",
    bodyMarkdown: "Content will be added later.",
  },
} satisfies Record<"ja" | "en", GuideContent>;

const storyByLocale = {
  ja: {
    slug: "pub-story",
    kind: "story",
    title: "パブの物語",
    summary: "パブの風景です。",
    category: "culture",
    publishedAt: "2026-09-03T00:00:00.000Z",
    bodyMarkdown: "![店内の写真](/media/550e8400-e29b-41d4-a716-446655440009)",
  },
  en: {
    slug: "pub-story",
    kind: "story",
    title: "A Pub Story",
    summary: "A scene from a pub.",
    category: "culture",
    publishedAt: "2026-09-03T00:00:00.000Z",
    bodyMarkdown: "![A pub interior](/media/550e8400-e29b-41d4-a716-446655440009)",
  },
} satisfies Record<"ja" | "en", StoryContent>;

const splitTheGMetadataByLocale = {
  ja: {
    slug: "split-the-g",
    kind: "guide",
    title: "Split the Gを楽しむ",
    summary: "Guinnessのグラスを使ったPubの遊び「Split the G」を、安全に楽しむためのガイドです。",
    category: "pub-culture",
    publishedAt: "2026-09-05T00:00:00.000Z",
    bodyMarkdown: "地域によって判定方法は異なります。\n\n[Irish Pubを探す →](/)",
  },
  en: {
    slug: "split-the-g",
    kind: "guide",
    title: "How to Enjoy Split the G",
    summary: "A guide to enjoying the pub game Split the G with a Guinness glass, safely and at your own pace.",
    category: "pub-culture",
    publishedAt: "2026-09-05T00:00:00.000Z",
    bodyMarkdown: "How the result is judged varies.\n\n[Find an Irish pub →](/)",
  },
} satisfies Record<"ja" | "en", GuideContent>;

let locale: "ja" | "en" = "ja";

beforeEach(() => {
  locale = "ja";
  pageMocks.getRequestLocale.mockReset().mockImplementation(() => Promise.resolve(locale));
  pageMocks.listPublishedContent
    .mockReset()
    .mockImplementation((kind: "guide" | "story", contentLocale: "ja" | "en") =>
      Promise.resolve(
        kind === "guide" ? [splitTheGMetadataByLocale[contentLocale], metadataByLocale[contentLocale]] : [],
      ),
    );
  pageMocks.getPublishedContentBySlug.mockReset().mockImplementation((kind, slug, contentLocale: "ja" | "en") => {
    if (kind === "story" && slug === "pub-story") return Promise.resolve(storyByLocale[contentLocale]);
    if (kind !== "guide") return Promise.resolve(null);
    if (slug === "sample") return Promise.resolve(metadataByLocale[contentLocale]);
    if (slug === "split-the-g") return Promise.resolve(splitTheGMetadataByLocale[contentLocale]);
    return Promise.resolve(null);
  });
  pageMocks.notFound.mockReset().mockImplementation(() => {
    throw new Error("not-found");
  });
  pageMocks.isDataSourceConfigured.mockReset().mockReturnValue(true);
  pageMocks.getDailyPublishedQuiz.mockReset().mockResolvedValue({
    id: "e2e-published-question",
    category: "history",
    question: "Today's question",
    choices: ["one", "two", "three", "four"].map((id) => ({ id, label: id })),
  });
});

describe("Discover pages", () => {
  it("HubでStories placeholderと公開Editorial Guide、Quizへの導線を表示する", async () => {
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

  it("公開済みStoryがある場合は一覧導線と日英本文画像を表示する", async () => {
    pageMocks.listPublishedContent.mockImplementation((kind: "guide" | "story", contentLocale: "ja" | "en") =>
      Promise.resolve(kind === "story" ? [storyByLocale[contentLocale]] : []),
    );
    const { unmount } = render(await DiscoverPage());
    expect(screen.getByRole("link", { name: "物語を読む: パブの物語" })).toHaveAttribute(
      "href",
      "/discover/stories/pub-story",
    );
    expect(screen.queryByText("準備中")).not.toBeInTheDocument();

    unmount();
    render(await StoryPage({ params: Promise.resolve({ slug: "pub-story" }) }));
    expect(screen.getByRole("img", { name: "店内の写真" })).toHaveAttribute(
      "src",
      "/media/550e8400-e29b-41d4-a716-446655440009",
    );
    expect(screen.getByRole("navigation", { name: "現在位置" })).toBeInTheDocument();

    locale = "en";
    render(await StoryPage({ params: Promise.resolve({ slug: "pub-story" }) }));
    expect(screen.getByRole("img", { name: "A pub interior" })).toBeInTheDocument();
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

  it("未登録Storyを404として扱う", async () => {
    await expect(StoryPage({ params: Promise.resolve({ slug: "unknown" }) })).rejects.toThrow("not-found");
    await expect(generateStoryMetadata({ params: Promise.resolve({ slug: "unknown" }) })).rejects.toThrow("not-found");
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

  it("DB未設定時は一般化した利用不可状態を表示する", async () => {
    pageMocks.isDataSourceConfigured.mockReturnValue(false);

    render(await QuizPage());

    expect(screen.getByRole("heading", { level: 2, name: "今日のクイズを利用できません" })).toBeInTheDocument();
    expect(screen.getByText("クイズを現在利用できません。時間をおいてもう一度お試しください。")).toBeInTheDocument();
    expect(pageMocks.getDailyPublishedQuiz).not.toHaveBeenCalled();
  });

  it("Published Questionが0件の場合は空状態を表示する", async () => {
    pageMocks.getDailyPublishedQuiz.mockResolvedValue(null);

    render(await QuizPage());

    expect(screen.getByRole("heading", { level: 2, name: "今日のクイズはありません" })).toBeInTheDocument();
    expect(
      screen.getByText("現在公開されている問題がありません。しばらくしてからもう一度ご確認ください。"),
    ).toBeInTheDocument();
  });

  it("DB取得失敗時は一般化した利用不可状態を表示する", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    pageMocks.getDailyPublishedQuiz.mockRejectedValue(new Error("database details"));

    render(await QuizPage());

    expect(screen.getByRole("heading", { level: 2, name: "今日のクイズを利用できません" })).toBeInTheDocument();
    expect(screen.queryByText("database details")).not.toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it("各ページのMetadataをLocaleとGuide metadataから生成する", async () => {
    await expect(generateDiscoverMetadata()).resolves.toMatchObject({
      title: "Explore Ireland | Irish Pub Map",
    });
    await expect(generateGuideMetadata({ params: Promise.resolve({ slug: "sample" }) })).resolves.toEqual({
      title: "サンプルガイド | Irish Pub Map",
      description: metadataByLocale.ja.summary,
      alternates: { canonical: "https://irishpub-map-web.vercel.app/discover/guides/sample" },
    });

    locale = "en";
    await expect(generateQuizMetadata()).resolves.toMatchObject({
      title: "Today's Ireland Quiz | Irish Pub Map",
      description: "Learn something new about Irish culture, history, and pub traditions with today's question.",
    });
  });
});
