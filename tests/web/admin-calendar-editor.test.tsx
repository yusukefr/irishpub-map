import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminCalendarEditor } from "../../apps/web/app/components/admin-calendar-editor";
import type { AdminCalendarEvent } from "../../apps/web/app/lib/calendar/types";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const fetchMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.stubGlobal("fetch", fetchMock);

const event: AdminCalendarEvent = {
  id: "st-patricks-day",
  category: "culture",
  dateRule: { type: "fixed", month: 3, day: 17 },
  isPublicHoliday: false,
  featured: true,
  aliases: ["Saint Patrick\u0027s Day"],
  source: "https://example.com/calendar",
  sortOrder: 1,
  isPublished: false,
  translations: {
    ja: { name: "聖パトリックの日", description: "説明" },
    en: { name: "St. Patrick\u0027s Day", description: "Description" },
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
});

describe("AdminCalendarEditor", () => {
  it("renders bilingual fields, date rule, aliases, and immutable ID", () => {
    render(<AdminCalendarEditor initialEvent={event} databaseConfigured locale="ja" />);
    expect(screen.getByRole("heading", { name: "Calendar Eventを編集" })).toBeInTheDocument();
    expect(screen.getByDisplayValue(event.id)).toBeDisabled();
    expect(screen.getAllByDisplayValue("聖パトリックの日")).toHaveLength(1);
    expect(screen.getByDisplayValue("Saint Patrick\u0027s Day")).toBeInTheDocument();
    expect(screen.getByText("毎年3月17日")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aliasを追加" }));
    fireEvent.change(screen.getAllByRole("textbox", { name: /別名/ })[1], { target: { value: "別名" } });
    expect(screen.getAllByRole("textbox", { name: /別名/ })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Aliasを削除" })[1]);
    expect(screen.getAllByRole("textbox", { name: /別名/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("checkbox", { name: "祝日" }));
    expect(screen.getByRole("checkbox", { name: "祝日" })).toBeChecked();
  });

  it("creates a draft and redirects to the created event", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ event }), { status: 201 }));
    render(<AdminCalendarEditor initialEvent={null} databaseConfigured locale="ja" />);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: event.id } });
    fireEvent.click(screen.getByRole("button", { name: "下書きを保存" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/admin/calendar/${event.id}`));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/calendar",
      expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" } }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toHaveProperty("id", event.id);
  });

  it("saves existing data, publishes, returns to draft, and deletes after confirmation", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ event }), { status: 200 }));
    render(<AdminCalendarEditor initialEvent={event} databaseConfigured locale="ja" />);
    fireEvent.change(screen.getAllByLabelText("説明")[0], { target: { value: "更新説明" } });
    fireEvent.click(screen.getByRole("button", { name: "下書きを保存" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "PUT" });

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ publication: { isPublished: true, unchanged: false } }), { status: 200 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Calendar Eventを公開しました。");

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ publication: { isPublished: false, unchanged: false } }), { status: 200 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "下書きに戻す" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Calendar Eventを下書きに戻しました。");

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/admin/calendar"));
    expect(fetchMock.mock.calls.at(-1)?.[1]).toMatchObject({ method: "DELETE" });
  });

  it("shows API errors and disables mutations when database is unavailable", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errorCode: "publication_requirements_not_met",
          fieldErrors: { category: "required", ignored: 1 },
          missingFields: ["category"],
        }),
        {
          status: 422,
        },
      ),
    );
    render(<AdminCalendarEditor initialEvent={event} databaseConfigured locale="ja" />);
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    expect(await screen.findByText("Calendar Eventが公開条件を満たしていません。")).toBeInTheDocument();
    expect(screen.getByText(/公開前に入力してください: カテゴリー/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "カテゴリー" }), { target: { value: "culture" } });

    const unavailable = render(<AdminCalendarEditor initialEvent={event} databaseConfigured={false} locale="ja" />);
    expect(screen.getAllByText("データベース未設定のため保存・削除できません。")).not.toHaveLength(0);
    expect(within(unavailable.container).getByRole("button", { name: "公開する" })).toBeDisabled();
  });
  it("handles cancelled publication and network failures", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<AdminCalendarEditor initialEvent={event} databaseConfigured locale="ja" />);
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    expect(fetchMock).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    fetchMock.mockRejectedValueOnce(new Error("network"));
    fireEvent.click(screen.getByRole("button", { name: "公開する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("処理中にエラーが発生しました。");
  });
  it("handles published initial state and save, unpublish, and delete failures", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    const published = render(
      <AdminCalendarEditor initialEvent={{ ...event, isPublished: true }} databaseConfigured locale="ja" />,
    );
    expect(screen.getByRole("button", { name: "下書きに戻す" })).toBeInTheDocument();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "下書きに戻す" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("処理中にエラーが発生しました。");
    published.unmount();
    cleanup();

    const draft = render(<AdminCalendarEditor initialEvent={null} databaseConfigured locale="ja" />);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "draft-event" } });
    fireEvent.click(screen.getByRole("button", { name: "下書きを保存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("処理中にエラーが発生しました。");
    draft.unmount();
  });
});
