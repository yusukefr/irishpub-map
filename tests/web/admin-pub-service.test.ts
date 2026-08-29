// Draft / Publish ValidationとRepository業務結果の変換をApplication Service単位で保証します。
import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  getAdminPub: vi.fn(),
  insertAdminPub: vi.fn(),
  removeAdminPub: vi.fn(),
  replaceAdminPub: vi.fn(),
  validateAdminPubReferences: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/admin-pub-repository", () => repositoryMocks);

import {
  AdminPubServiceError,
  createAdminPub,
  deleteAdminPub,
  getPublicationMissingFields,
  readAdminPub,
  updateAdminPub,
} from "../../apps/web/app/lib/admin-pub-service";

const draftInput = {
  prefectureCode: null,
  municipalityCode: null,
  latitude: null,
  longitude: null,
  websiteUrl: null,
  googleMapsUrl: null,
  instagramUrl: null,
  status: null,
  translations: {
    ja: { name: "下書き", nameReading: null, address: null },
    en: null,
  },
  tagIds: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  repositoryMocks.validateAdminPubReferences.mockResolvedValue({ fieldErrors: {}, statusCode: null });
});

describe("admin pub service", () => {
  it("rejects invalid draft input before querying references", async () => {
    await expect(createAdminPub({})).rejects.toMatchObject<AdminPubServiceError>({
      code: "validation",
    });
    expect(repositoryMocks.validateAdminPubReferences).not.toHaveBeenCalled();
  });

  it("maps invalid references to a conflict before opening the write transaction", async () => {
    repositoryMocks.validateAdminPubReferences.mockResolvedValue({
      fieldErrors: { municipalityCode: "invalid_format" },
      statusCode: null,
    });

    await expect(createAdminPub(draftInput)).rejects.toMatchObject<AdminPubServiceError>({
      code: "reference_conflict",
      fieldErrors: { municipalityCode: "invalid_format" },
    });
    expect(repositoryMocks.insertAdminPub).not.toHaveBeenCalled();
  });

  it("creates an unpublished draft and reads the authoritative result", async () => {
    repositoryMocks.getAdminPub.mockImplementation(async (id: string) => ({
      id,
      isPublished: false,
      ...draftInput,
      updatedAt: "2026-08-29T03:00:00.000Z",
    }));

    const created = await createAdminPub(draftInput);
    expect(created.isPublished).toBe(false);
    expect(repositoryMocks.insertAdminPub).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]{36}$/i),
      draftInput,
      null,
    );
  });

  it("blocks an incomplete update only when the repository finds a published row", async () => {
    repositoryMocks.replaceAdminPub.mockResolvedValue("publication_blocked");

    await expect(updateAdminPub("550e8400-e29b-41d4-a716-446655440001", draftInput)).rejects.toMatchObject({
      code: "publication_requirements_not_met",
      missingFields: ["address", "prefecture", "municipality", "latitude", "longitude", "status"],
    });
    expect(repositoryMocks.replaceAdminPub).toHaveBeenCalledWith(expect.any(String), draftInput, null, false);
  });

  it("reports missing reads and deletes as not found", async () => {
    repositoryMocks.getAdminPub.mockResolvedValue(null);
    repositoryMocks.removeAdminPub.mockResolvedValue(false);

    await expect(readAdminPub("550e8400-e29b-41d4-a716-446655440001")).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(deleteAdminPub("550e8400-e29b-41d4-a716-446655440001")).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("returns no publication gaps for a complete snapshot", () => {
    expect(
      getPublicationMissingFields({
        ...draftInput,
        prefectureCode: 13,
        municipalityCode: "131016",
        latitude: 35,
        longitude: 139,
        status: "open",
        translations: {
          ...draftInput.translations,
          ja: { ...draftInput.translations.ja, address: "東京都" },
        },
      }),
    ).toEqual([]);
  });
});
