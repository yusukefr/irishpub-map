import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { E2E_TEST_DATA } from "../../apps/web/app/lib/e2e-test-fixtures";
import { MediaPicker } from "../../apps/web/app/components/media/media-picker";

vi.mock("next/image", async () => {
  const React = await import("react");
  return { default: ({ src, alt }: { src: string; alt: string }) => React.createElement("img", { src, alt }) };
});

const fetchMock = vi.fn();
const onSelect = vi.fn();
const landscape = E2E_TEST_DATA.media.landscape;
const portrait = E2E_TEST_DATA.media.portrait;
const response = (media = [landscape], total = media.length) =>
  new Response(
    JSON.stringify({ media, total, page: 1, pageSize: 50, databaseConfigured: true, storageConfigured: true }),
  );
const showModalMock = vi.fn(function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
});
const closeMock = vi.fn(function (this: HTMLDialogElement) {
  this.removeAttribute("open");
});
const createObjectUrlMock = vi.fn(() => "blob:picker-preview");
const revokeObjectUrlMock = vi.fn();
let showModalDescriptor: PropertyDescriptor | undefined;
let closeDescriptor: PropertyDescriptor | undefined;
let createObjectUrlDescriptor: PropertyDescriptor | undefined;
let revokeObjectUrlDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  fetchMock.mockReset();
  onSelect.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  showModalDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
  closeDescriptor = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
  createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
  showModalMock.mockClear();
  closeMock.mockClear();
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: showModalMock });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: closeMock });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrlMock });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrlMock });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (showModalDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "showModal", showModalDescriptor);
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal;
  if (closeDescriptor) Object.defineProperty(HTMLDialogElement.prototype, "close", closeDescriptor);
  else delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close;
  if (createObjectUrlDescriptor) Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
  else delete (URL as Partial<typeof URL>).createObjectURL;
  if (revokeObjectUrlDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
  else delete (URL as Partial<typeof URL>).revokeObjectURL;
});

describe("MediaPicker", () => {
  it("opens a native dialog, selects temporarily, and commits only with Use selected", async () => {
    fetchMock.mockResolvedValue(response());
    render(<MediaPicker locale="ja" selectedId={null} triggerLabel="画像を選択" onSelect={onSelect} />);
    const trigger = screen.getByRole("button", { name: "画像を選択" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "画像を選択" });
    expect(showModalMock).toHaveBeenCalled();

    const card = await screen.findByRole("button", { name: new RegExp(landscape.id) });
    fireEvent.click(card);
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "選択した画像を使う" }));
    expect(onSelect).toHaveBeenCalledWith(landscape);
    expect(dialog).not.toHaveAttribute("open");
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("preserves the current value when cancelled or dismissed with Escape", async () => {
    fetchMock.mockResolvedValue(response());
    render(<MediaPicker locale="ja" selectedId={landscape.id} triggerLabel="画像を変更" onSelect={onSelect} />);
    const trigger = screen.getByRole("button", { name: "画像を変更" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "画像を選択" });
    await screen.findByRole("button", { name: new RegExp(landscape.id) });
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/admin/media/${landscape.id}`);

    fireEvent.click(screen.getAllByRole("button", { name: "キャンセル" })[0]);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    const reopened = screen.getByRole("dialog", { name: "画像を選択" });
    fireEvent(reopened, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(reopened).not.toHaveAttribute("open");
  });

  it("keeps a selected asset available when it is outside the current page", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === `/api/admin/media/${portrait.id}`)
        return Promise.resolve(new Response(JSON.stringify({ media: portrait })));
      return Promise.resolve(response([landscape], 51));
    });
    render(<MediaPicker locale="en" selectedId={portrait.id} triggerLabel="Change image" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Change image" }));
    await screen.findByRole("button", { name: new RegExp(landscape.id) });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/admin/media/${portrait.id}`));
    fireEvent.click(screen.getByRole("button", { name: "Use selected" }));
    expect(onSelect).toHaveBeenCalledWith(portrait);
  });

  it("uploads into the picker as a temporary selection without auto-committing", async () => {
    fetchMock.mockResolvedValueOnce(response());
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ media: portrait }), { status: 201 }));
    fetchMock.mockResolvedValueOnce(response([portrait, landscape]));
    render(<MediaPicker locale="ja" selectedId={null} triggerLabel="画像を選択" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "画像を選択" }));
    await screen.findByRole("button", { name: new RegExp(landscape.id) });
    fireEvent.change(screen.getByLabelText("画像ファイル"), {
      target: { files: [new File(["image"], "new.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "アップロード" }));
    const newAssetCard = await screen.findByRole("button", { name: new RegExp(portrait.id) });
    expect(newAssetCard).toHaveAttribute("aria-pressed", "true");
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "選択した画像を使う" }));
    expect(onSelect).toHaveBeenCalledWith(portrait);
  });
});
