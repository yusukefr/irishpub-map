import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { E2E_TEST_DATA } from "../../apps/web/app/lib/e2e-test-fixtures";
import { AdminMediaManager } from "../../apps/web/app/components/media/admin-media-manager";

vi.mock("next/image", async () => {
  const React = await import("react");
  return { default: ({ src, alt }: { src: string; alt: string }) => React.createElement("img", { src, alt }) };
});

const media = [E2E_TEST_DATA.media.landscape, E2E_TEST_DATA.media.portrait];
function pageResponse({
  page = 1,
  items = media,
  total = 2,
  databaseConfigured = true,
  storageConfigured = true,
} = {}) {
  return new Response(
    JSON.stringify({ media: items, total, page, pageSize: 50, databaseConfigured, storageConfigured }),
  );
}

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Media Library in the admin manager", () => {
  it("loads page one and displays media metadata without the Blob URL", async () => {
    fetchMock.mockResolvedValue(pageResponse());
    render(<AdminMediaManager locale="ja" />);

    expect(await screen.findByRole("heading", { name: "Media管理" })).toBeVisible();
    expect(await screen.findByText("1200 × 800")).toBeVisible();
    expect(screen.getByText("JPEG")).toBeVisible();
    expect(screen.getAllByText("Media ID")[0].parentElement).toHaveTextContent(media[0].id);
    expect(screen.queryByText(media[0].url)).not.toBeInTheDocument();
    expect(screen.queryByText("private/internal-key.png")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/media?page=1");
  });

  it("uses page-based Previous and Next navigation", async () => {
    fetchMock.mockResolvedValueOnce(pageResponse({ items: [media[0]], total: 51 }));
    fetchMock.mockResolvedValueOnce(pageResponse({ page: 2, items: [media[1]], total: 51 }));
    render(<AdminMediaManager locale="ja" />);
    await screen.findByText(media[0].id);

    expect(screen.getByRole("button", { name: "前へ" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    expect(await screen.findByText(media[1].id)).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/media?page=2");
    expect(screen.getByRole("button", { name: "前へ" })).toBeEnabled();
  });

  it("corrects an out-of-range page to the final page without looping", async () => {
    fetchMock.mockResolvedValueOnce(pageResponse({ total: 100 }));
    fetchMock.mockResolvedValueOnce(pageResponse({ page: 2, items: [], total: 12 }));
    fetchMock.mockResolvedValueOnce(pageResponse({ items: [media[0]], total: 12 }));
    render(<AdminMediaManager locale="ja" />);
    await screen.findByText(media[0].id);
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(await screen.findByText(media[0].id)).toBeVisible();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/admin/media?page=1",
      "/api/admin/media?page=2",
      "/api/admin/media?page=1",
    ]);
  });

  it("shows empty, database, and storage configuration states", async () => {
    fetchMock.mockResolvedValueOnce(
      pageResponse({ items: [], total: 0, databaseConfigured: false, storageConfigured: false }),
    );
    const { unmount } = render(<AdminMediaManager locale="en" />);
    expect(await screen.findByText("The media database is unavailable. Check its configuration.")).toBeVisible();
    expect(screen.getByLabelText("Image file")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Upload image" })).toBeDisabled();
    unmount();

    fetchMock.mockResolvedValueOnce(pageResponse({ storageConfigured: false }));
    render(<AdminMediaManager locale="en" />);
    expect(await screen.findByText(media[0].id)).toBeVisible();
    expect(screen.getByText(/Image storage is unavailable/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Upload image" })).toBeDisabled();
  });

  it("shows a deliberate empty state when the configured database has no media", async () => {
    fetchMock.mockResolvedValue(pageResponse({ items: [], total: 0 }));
    render(<AdminMediaManager locale="en" />);
    expect(
      await screen.findByText("No images have been registered yet. Upload the first image to get started."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("announces initial loading and exposes retry when the first request fails", async () => {
    let rejectRequest!: (error: Error) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectRequest = reject;
      }),
    );
    fetchMock.mockResolvedValueOnce(pageResponse());
    render(<AdminMediaManager locale="en" />);
    expect(await screen.findByRole("status")).toHaveTextContent("Loading media…");
    rejectRequest(new Error("network"));
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(await screen.findByText(media[0].id)).toBeVisible();
  });

  it("keeps the current list on a fetch error and retries the current page", async () => {
    fetchMock.mockResolvedValueOnce(pageResponse({ total: 51 }));
    fetchMock.mockRejectedValueOnce(new Error("private provider details"));
    fetchMock.mockResolvedValueOnce(pageResponse({ page: 2 }));
    render(<AdminMediaManager locale="en" />);
    await screen.findByText(media[0].id);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load media.");
    expect(screen.getByText(media[0].id)).toBeVisible();
    expect(screen.getByText("1–50 / 51")).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.queryByText("private provider details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(media[1].id)).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/media?page=2");
  });

  it("keeps the uploaded first page when an older page request completes later", async () => {
    let resolveOldPage!: (response: Response) => void;
    fetchMock.mockResolvedValueOnce(pageResponse({ items: [media[0]], total: 51 }));
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveOldPage = resolve;
      }),
    );
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ media: media[1] }), { status: 201 }));
    fetchMock.mockResolvedValueOnce(pageResponse({ items: [media[1]], total: 2 }));
    render(<AdminMediaManager locale="en" />);
    await screen.findByText(media[0].id);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/media?page=2"));
    const file = new File(["image"], "upload", { type: "" });
    fireEvent.change(screen.getByLabelText("Image file"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload image" }));
    expect(await screen.findByText(media[1].id)).toBeVisible();

    await act(async () => resolveOldPage(pageResponse({ page: 2, items: [media[0]], total: 51 })));
    expect(screen.getByText(media[1].id)).toBeVisible();
    expect(screen.queryByText(media[0].id)).not.toBeInTheDocument();
    expect(screen.getByText("1–2 / 2")).toBeVisible();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
