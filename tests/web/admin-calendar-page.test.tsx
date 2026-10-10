import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  readAdminCalendarList: vi.fn(),
  isCalendarDatabaseConfigured: vi.fn(),
}));

vi.mock("../../apps/web/app/lib/admin-server", () => ({ requireAdminSession: mocks.requireAdminSession }));
vi.mock("../../apps/web/app/lib/admin-calendar-service", () => ({
  readAdminCalendarList: mocks.readAdminCalendarList,
}));
vi.mock("../../apps/web/app/lib/calendar/repository", () => ({
  isCalendarDatabaseConfigured: mocks.isCalendarDatabaseConfigured,
}));
vi.mock("../../apps/web/app/lib/e2e-test-mode", () => ({ isE2ETestMode: () => false }));
vi.mock("../../apps/web/app/lib/i18n/server", () => ({ getRequestLocale: () => Promise.resolve("ja") }));

import AdminCalendarPage from "../../apps/web/app/admin/(protected)/calendar/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminSession.mockResolvedValue(undefined);
  mocks.readAdminCalendarList.mockResolvedValue([]);
  mocks.isCalendarDatabaseConfigured.mockReturnValue(true);
});

describe("Admin Calendar page", () => {
  it("IDを一覧に表示せず、IDを使った編集リンクを維持する", async () => {
    const event = {
      id: "11111111-1111-4111-8111-000000000001",
      nameJa: "祝日イベント",
      nameEn: "Holiday event",
      category: "public_holiday",
      dateRule: { type: "fixed", month: 8, day: 1 },
      isPublicHoliday: true,
      featured: false,
      isPublished: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.readAdminCalendarList.mockResolvedValue([event]);

    render(await AdminCalendarPage());

    expect(screen.getByRole("heading", { name: "Calendar管理" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Event ID" })).not.toBeInTheDocument();
    expect(screen.queryByText(event.id)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "編集" })).toHaveAttribute("href", `/admin/calendar/${event.id}`);
  });
});
