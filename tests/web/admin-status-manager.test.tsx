import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminStatusManager } from "../../apps/web/app/components/admin-status-manager";

const fetchMock = vi.fn();
const statuses = [
  { code: 1, key: "open", nameJa: "営業中", nameEn: "Open" },
  { code: 2, key: "temporarily_closed", nameJa: "一時休業", nameEn: null },
];

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("AdminStatusManager", () => {
  it("shows fixed keys, both names, and an unregistered English state", () => {
    render(<AdminStatusManager initialStatuses={statuses} databaseConfigured locale="ja" />);
    expect(screen.getByRole("heading", { name: "登録ステータス（2件）" })).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("未登録")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "追加" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "削除" })).not.toBeInTheDocument();
  });

  it("keeps the key read-only and saves edited Japanese and English names once", async () => {
    let resolveResponse!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (resolveResponse = resolve)));
    render(<AdminStatusManager initialStatuses={statuses} databaseConfigured locale="ja" />);
    fireEvent.click(screen.getAllByRole("button", { name: "編集" })[1]);
    expect(screen.getByDisplayValue("temporarily_closed")).toHaveAttribute("readonly");
    fireEvent.change(screen.getByLabelText("日本語"), { target: { value: "臨時休業" } });
    fireEvent.change(screen.getByLabelText("English（任意）"), { target: { value: "Temporarily Closed" } });
    const form = screen.getByRole("button", { name: "更新" }).closest("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole("button", { name: "保存中…" })).toBeDisabled());
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/statuses/2", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nameJa: "臨時休業", nameEn: "Temporarily Closed" }),
    });

    resolveResponse(
      new Response(
        JSON.stringify({
          status: { code: 2, key: "temporarily_closed", nameJa: "臨時休業", nameEn: "Temporarily Closed" },
        }),
      ),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("ステータス表示名を更新しました。");
    expect(screen.getByText("Temporarily Closed")).toBeInTheDocument();
  });

  it("associates the immutable key help text with the key field", () => {
    render(<AdminStatusManager initialStatuses={statuses} databaseConfigured locale="en" />);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    const keyInput = screen.getByDisplayValue("open");
    expect(keyInput).toHaveAttribute("readonly");
    expect(keyInput).toHaveAttribute("aria-describedby", "status-key-description");
    expect(screen.getByText("This system identifier cannot be changed.")).toBeInTheDocument();
  });

  it("shows localized field and general API errors", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errorCode: "validation_error", fieldErrors: { nameJa: "required" } }), {
          status: 422,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ errorCode: "status_not_found" }), { status: 404 }));
    render(<AdminStatusManager initialStatuses={[statuses[0]]} databaseConfigured locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const form = screen.getByRole("button", { name: "Update" }).closest("form")!;
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("The Japanese display name is required.");
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("The status was not found.");
  });

  it("disables editing when the database is not configured", () => {
    render(<AdminStatusManager initialStatuses={statuses} databaseConfigured={false} locale="ja" />);
    expect(screen.getByText("DATABASE_URL が未設定です。閲覧のみ可能です。")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: "編集" })) expect(button).toBeDisabled();
  });
});
