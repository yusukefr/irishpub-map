import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ locale: vi.fn(), list: vi.fn(), get: vi.fn(), notFound: vi.fn() }));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: mocks.locale }));
vi.mock("../../apps/web/app/lib/content/legacy-repository", () => ({
  listLegacyGuides: mocks.list,
  loadLegacyGuide: mocks.get,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
import DiscoverPage from "../../apps/web/app/(content)/discover/page";
import GuidePage, { generateMetadata } from "../../apps/web/app/(content)/discover/guides/[slug]/page";
const article = {
  slug: "sample",
  kind: "guide" as const,
  title: "サンプルガイド",
  summary: "要約",
  category: "culture" as const,
  publishedAt: "2026-09-02",
};
beforeEach(() => {
  mocks.locale.mockReset().mockResolvedValue("ja");
  mocks.list.mockReset().mockResolvedValue([article]);
  mocks.get
    .mockReset()
    .mockImplementation((slug) =>
      Promise.resolve(slug === "sample" ? { Component: () => <p>MDX本文</p>, metadata: article } : null),
    );
  mocks.notFound.mockReset().mockImplementation(() => {
    throw new Error("not-found");
  });
});
describe("Discover pages", () => {
  it("公開RepositoryのGuide一覧を表示する", async () => {
    render(await DiscoverPage());
    expect(mocks.list).toHaveBeenCalledWith("ja");
    expect(screen.getByRole("link", { name: "サンプルガイド →" })).toHaveAttribute("href", "/discover/guides/sample");
  });
  it("DB Markdownを固定Rendererで表示しmetadataを生成する", async () => {
    render(await GuidePage({ params: Promise.resolve({ slug: "sample" }) }));
    expect(screen.getByRole("heading", { level: 1, name: "サンプルガイド" })).toBeInTheDocument();
    expect(screen.getByText("MDX本文")).toBeInTheDocument();
    await expect(generateMetadata({ params: Promise.resolve({ slug: "sample" }) })).resolves.toEqual({
      title: "サンプルガイド | Irish Pub Map",
      description: "要約",
    });
  });
  it("公開されないslugは404にする", async () => {
    await expect(GuidePage({ params: Promise.resolve({ slug: "draft" }) })).rejects.toThrow("not-found");
  });
});
