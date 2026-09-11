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

vi.mock("../../apps/web/app/lib/admin-content-repository", () => repositoryMocks);
vi.mock("../../apps/web/app/lib/content/cache", () => cacheMocks);

const id = "550e8400-e29b-41d4-a716-446655440001";
const completeInput = {
  kind: "guide" as const,
  slug: "pub-etiquette",
  category: "pub-culture" as const,
  translations: {
    ja: { title: "パブの作法", summary: "要約", bodyMarkdown: "[案内](/discover)" },
    en: { title: "Pub etiquette", summary: "Summary", bodyMarkdown: "[Guide](https://example.com)" },
  },
};
const published: AdminContent = {
  id,
  ...completeInput,
  status: "published",
  publishedAt: "2026-09-11T01:00:00.000Z",
  createdAt: "2026-09-11T00:00:00.000Z",
  updatedAt: "2026-09-11T01:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
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
      translations: { ...published.translations, en: { title: "", summary: "", bodyMarkdown: "" } },
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
      identity: { kind: "guide", slug: "pub-etiquette" },
    });

    await expect(changeAdminContentPublication(id, "published")).resolves.toEqual({
      id,
      status: "published",
      unchanged: false,
    });
    expect(cacheMocks.invalidateContentCache).toHaveBeenCalledWith("guide", "pub-etiquette");
  });
});
