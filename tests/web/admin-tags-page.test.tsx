import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pageMocks = vi.hoisted(() => ({ getAdminTags: vi.fn(), requireAdminSession: vi.fn() }));

vi.mock("../../apps/web/app/lib/admin-server", () => ({ requireAdminSession: pageMocks.requireAdminSession }));
vi.mock("../../apps/web/app/lib/tag-repository", () => ({ getAdminTags: pageMocks.getAdminTags }));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: () => Promise.resolve("ja") }));
vi.mock("../../apps/web/app/components/admin-tag-manager", () => ({
  AdminTagManager: ({ initialTags }: { initialTags: Array<{ translations: { ja: string } }> }) => (
    <p>{initialTags.map((tag) => tag.translations.ja).join(",")}</p>
  ),
}));

import AdminTagsPage from "../../apps/web/app/admin/(protected)/tags/page";

beforeEach(() => {
  pageMocks.getAdminTags.mockReset();
  pageMocks.requireAdminSession.mockReset();
});

describe("AdminTagsPage", () => {
  it("does not load tag data when the session is invalid", async () => {
    pageMocks.requireAdminSession.mockRejectedValue(new Error("redirect:/admin/login"));

    await expect(AdminTagsPage()).rejects.toThrow("redirect:/admin/login");
    expect(pageMocks.getAdminTags).not.toHaveBeenCalled();
  });

  it("loads tag data after validating the session", async () => {
    pageMocks.requireAdminSession.mockResolvedValue(undefined);
    pageMocks.getAdminTags.mockResolvedValue([{ translations: { ja: "ウイスキー" } }]);

    render(await AdminTagsPage());

    expect(pageMocks.requireAdminSession.mock.invocationCallOrder[0]).toBeLessThan(
      pageMocks.getAdminTags.mock.invocationCallOrder[0],
    );
    expect(screen.getByText("ウイスキー")).toBeInTheDocument();
  });
});
