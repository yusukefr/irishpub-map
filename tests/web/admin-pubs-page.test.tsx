import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pageMocks = vi.hoisted(() => ({
  getAdminPubPage: vi.fn(),
  getMunicipalitiesByPrefecture: vi.fn(),
  getPrefectures: vi.fn(),
  getPubStatuses: vi.fn(),
  getTags: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  requireAdminSession: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/admin-server", () => ({
  requireAdminSession: pageMocks.requireAdminSession,
}));
vi.mock("../../apps/web/app/lib/pub-repository", () => ({
  getAdminPubPage: pageMocks.getAdminPubPage,
  isDatabaseConfigured: pageMocks.isDatabaseConfigured,
}));
vi.mock("../../apps/web/app/lib/master-repository", () => ({
  getMunicipalitiesByPrefecture: pageMocks.getMunicipalitiesByPrefecture,
  getPrefectures: pageMocks.getPrefectures,
  getPubStatuses: pageMocks.getPubStatuses,
  getTags: pageMocks.getTags,
}));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: () => Promise.resolve("ja") }));
vi.mock("../../apps/web/app/components/admin-pub-manager", () => ({
  AdminPubManager: ({ initialPage }: { initialPage: { pubs: Array<{ name: string }> } }) => (
    <p>{initialPage.pubs.map((pub) => pub.name).join(",")}</p>
  ),
}));

import AdminPubsPage from "../../apps/web/app/admin/(protected)/pubs/page";

beforeEach(() => {
  pageMocks.getAdminPubPage.mockReset();
  pageMocks.getMunicipalitiesByPrefecture.mockReset();
  pageMocks.getPrefectures.mockReset().mockResolvedValue([]);
  pageMocks.getPubStatuses.mockReset().mockResolvedValue([]);
  pageMocks.getTags.mockReset().mockResolvedValue([]);
  pageMocks.isDatabaseConfigured.mockReset();
  pageMocks.requireAdminSession.mockReset();
});

describe("AdminPubsPage", () => {
  it("does not load admin pubs when the session is invalid", async () => {
    pageMocks.requireAdminSession.mockRejectedValue(new Error("redirect:/admin/login"));

    await expect(AdminPubsPage()).rejects.toThrow("redirect:/admin/login");
    expect(pageMocks.getAdminPubPage).not.toHaveBeenCalled();
  });

  it("loads admin pubs after validating the session", async () => {
    pageMocks.requireAdminSession.mockResolvedValue(undefined);
    pageMocks.getAdminPubPage.mockResolvedValue({ pubs: [{ name: "Draft pub" }], total: 1, page: 1, pageSize: 50 });
    pageMocks.isDatabaseConfigured.mockReturnValue(true);

    render(await AdminPubsPage());

    expect(pageMocks.requireAdminSession).toHaveBeenCalledOnce();
    expect(pageMocks.getAdminPubPage).toHaveBeenCalledWith({ page: 1 }, "ja");
    expect(pageMocks.requireAdminSession.mock.invocationCallOrder[0]).toBeLessThan(
      pageMocks.getAdminPubPage.mock.invocationCallOrder[0],
    );
    expect(screen.getByText("Draft pub")).toBeInTheDocument();
  });

  it("restores valid URL filters and loads municipalities for the selected prefecture", async () => {
    pageMocks.requireAdminSession.mockResolvedValue(undefined);
    pageMocks.getAdminPubPage.mockResolvedValue({ pubs: [], total: 0, page: 2, pageSize: 50 });
    pageMocks.getMunicipalitiesByPrefecture.mockResolvedValue([]);
    pageMocks.isDatabaseConfigured.mockReturnValue(true);

    await AdminPubsPage({
      searchParams: Promise.resolve({ prefecture: "23", municipality: "231002", published: "false", page: "2" }),
    });

    expect(pageMocks.getAdminPubPage).toHaveBeenCalledWith(
      { prefectureCode: 23, municipalityCode: "231002", isPublished: false, page: 2 },
      "ja",
    );
    expect(pageMocks.getMunicipalitiesByPrefecture).toHaveBeenCalledWith(23, "ja");
  });
});
