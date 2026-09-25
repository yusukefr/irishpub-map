import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminContent } from "../../packages/shared/src/admin-content";
import {
  AdminContentServiceError,
  changeAdminContentPublication,
  createAdminContent,
  updateAdminContent,
} from "../../apps/web/app/lib/admin-content-service";

const repositoryMocks = vi.hoisted(() => ({
  getAdminContent: vi.fn(),
  insertAdminContent: vi.fn(),
  listAdminContent: vi.fn(),
  replaceAdminContent: vi.fn(),
  setAdminContentPublication: vi.fn(),
}));
const cacheMocks = vi.hoisted(() => ({ invalidateContentCache: vi.fn() }));
const mediaMocks = vi.hoisted(() => ({ getMediaAsset: vi.fn() }));

vi.mock("../../apps/web/app/lib/admin-content-repository", () => repositoryMocks);
vi.mock("../../apps/web/app/lib/content/cache", () => cacheMocks);
vi.mock("../../apps/web/app/lib/media/repository", () => mediaMocks);

const id = "550e8400-e29b-41d4-a716-446655440001";
const heroId = "550e8400-e29b-41d4-a716-446655440009";
const completeInput = {
  kind: "guide" as const,
  slug: "pub-etiquette",
  category: "pub-culture" as const,
  heroImageAssetId: null,
  translations: {
    ja: {
      title: "パブの作法",
      summary: "要約",
      bodyMarkdown: "[案内](/discover)",
      heroImageAlt: "",
      heroImageCaption: "",
    },
    en: {
      title: "Pub etiquette",
      summary: "Summary",
      bodyMarkdown: "[Guide](https://example.com)",
      heroImageAlt: "",
      heroImageCaption: "",
    },
  },
};
const published: AdminContent = {
  id,
  ...completeInput,
  status: "published",
  publishedAt: "2026-09-11T01:00:00.000Z",
  heroImage: null,
  createdAt: "2026-09-11T00:00:00.000Z",
  updatedAt: "2026-09-11T01:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mediaMocks.getMediaAsset.mockResolvedValue({ id: heroId });
});

describe("admin content service", () => {
  it("creates a server-ID draft after validation", async () => {
    repositoryMocks.getAdminContent.mockResolvedValue({ ...published, status: "draft", publishedAt: null });
    await expect(createAdminContent(completeInput)).resolves.toMatchObject({ status: "draft" });
    expect(repositoryMocks.insertAdminContent).toHaveBeenCalledWith(expect.any(String), completeInput);
  });

  it("rejects unsafe Markdown URLs before writing", async () => {
    await expect(
      createAdminContent({
        ...completeInput,
        translations: {
          ...completeInput.translations,
          en: { ...completeInput.translations.en, bodyMarkdown: "[bad](javascript:alert(1))" },
        },
      }),
    ).rejects.toMatchObject({
      code: "validation",
      fieldErrors: { "translations.en.bodyMarkdown": "invalid_format" },
    });
    await expect(
      createAdminContent({
        ...completeInput,
        translations: {
          ...completeInput.translations,
          en: { ...completeInput.translations.en, bodyMarkdown: "[bad](&#9999999999;)" },
        },
      }),
    ).rejects.toMatchObject({ code: "validation" });
    expect(repositoryMocks.insertAdminContent).not.toHaveBeenCalled();
  });

  it("keeps published updates complete and invalidates old and new identities", async () => {
    repositoryMocks.replaceAdminContent.mockResolvedValue({
      code: "updated",
      previous: { kind: "story", slug: "old-slug" },
      previousStatus: "published",
    });
    repositoryMocks.getAdminContent.mockResolvedValue(published);

    await expect(updateAdminContent(id, completeInput)).resolves.toEqual(published);
    expect(repositoryMocks.replaceAdminContent).toHaveBeenCalledWith(id, completeInput, true);
    expect(cacheMocks.invalidateContentCache).toHaveBeenNthCalledWith(1, "story", "old-slug");
    expect(cacheMocks.invalidateContentCache).toHaveBeenNthCalledWith(2, "guide", "pub-etiquette");
  });

  it("blocks publishing incomplete content before changing state", async () => {
    repositoryMocks.getAdminContent.mockResolvedValue({
      ...published,
      status: "draft",
      publishedAt: null,
      slug: null,
      translations: {
        ...published.translations,
        en: { title: "", summary: "", bodyMarkdown: "", heroImageAlt: "", heroImageCaption: "" },
      },
    });

    await expect(changeAdminContentPublication(id, "published")).rejects.toEqual(
      expect.objectContaining<Partial<AdminContentServiceError>>({
        code: "publication_requirements_not_met",
        missingFields: ["slug", "translations.en.title", "translations.en.summary", "translations.en.bodyMarkdown"],
      }),
    );
    expect(repositoryMocks.setAdminContentPublication).not.toHaveBeenCalled();
  });

  it("publishes complete content and invalidates its public cache", async () => {
    repositoryMocks.getAdminContent.mockResolvedValue({ ...published, status: "draft", publishedAt: null });
    repositoryMocks.setAdminContentPublication.mockResolvedValue({
      id,
      status: "published",
      unchanged: false,
      publishedAt: "2026-09-11T02:30:00.000Z",
      identity: { kind: "guide", slug: "pub-etiquette" },
    });

    await expect(changeAdminContentPublication(id, "published")).resolves.toEqual({
      id,
      status: "published",
      unchanged: false,
      publishedAt: "2026-09-11T02:30:00.000Z",
    });
    expect(cacheMocks.invalidateContentCache).toHaveBeenCalledWith("guide", "pub-etiquette");
  });

  it("allows a hero draft without alt, but rejects a nonexistent media asset", async () => {
    const heroDraft = { ...completeInput, heroImageAssetId: heroId };
    repositoryMocks.getAdminContent.mockResolvedValue({ ...published, ...heroDraft, status: "draft" });
    await expect(createAdminContent(heroDraft)).resolves.toMatchObject({ status: "draft" });
    expect(mediaMocks.getMediaAsset).toHaveBeenCalledWith(heroId);
    mediaMocks.getMediaAsset.mockResolvedValueOnce(null);
    await expect(createAdminContent(heroDraft)).rejects.toMatchObject({
      code: "validation",
      fieldErrors: { heroImageAssetId: "invalid_format" },
    });
  });

  it("blocks incomplete hero alt on published updates and publication", async () => {
    const heroInput = { ...completeInput, heroImageAssetId: heroId };
    repositoryMocks.replaceAdminContent.mockResolvedValue({ code: "publication_blocked" });
    await expect(updateAdminContent(id, heroInput)).rejects.toMatchObject({
      code: "publication_requirements_not_met",
      missingFields: ["translations.ja.heroImageAlt", "translations.en.heroImageAlt"],
    });
    expect(repositoryMocks.replaceAdminContent).toHaveBeenCalledWith(id, heroInput, false);

    repositoryMocks.getAdminContent.mockResolvedValue({
      ...published,
      heroImageAssetId: heroId,
      status: "draft",
    });
    await expect(changeAdminContentPublication(id, "published")).rejects.toMatchObject({
      missingFields: ["translations.ja.heroImageAlt", "translations.en.heroImageAlt"],
    });
    expect(repositoryMocks.setAdminContentPublication).not.toHaveBeenCalled();
  });

  it("saves a published hero with both alt texts and invalidates detail and list caches", async () => {
    const heroInput = {
      ...completeInput,
      heroImageAssetId: heroId,
      translations: {
        ja: { ...completeInput.translations.ja, heroImageAlt: "パブの写真" },
        en: { ...completeInput.translations.en, heroImageAlt: "Pub photo" },
      },
    };
    repositoryMocks.replaceAdminContent.mockResolvedValue({
      code: "updated",
      previous: { kind: "guide", slug: "pub-etiquette" },
      previousStatus: "published",
    });
    repositoryMocks.getAdminContent.mockResolvedValue({ ...published, ...heroInput, heroImage: { id: heroId } });
    await expect(updateAdminContent(id, heroInput)).resolves.toMatchObject({ heroImageAssetId: heroId });
    expect(repositoryMocks.replaceAdminContent).toHaveBeenCalledWith(id, heroInput, true);
    expect(cacheMocks.invalidateContentCache).toHaveBeenCalledWith("guide", "pub-etiquette");
  });
});
