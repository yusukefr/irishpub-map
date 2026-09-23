import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MEDIA_MAX_FILE_SIZE_BYTES } from "@irishpub-map/shared/media";
import { E2E_TEST_DATA } from "../../apps/web/app/lib/e2e-test-fixtures";
import { MediaUploader } from "../../apps/web/app/components/media/media-uploader";

vi.mock("next/image", async () => {
  const React = await import("react");
  return { default: ({ src, alt }: { src: string; alt: string }) => React.createElement("img", { src, alt }) };
});

const fetchMock = vi.fn();
const createObjectUrl = vi.fn(() => "blob:local-preview");
const revokeObjectUrl = vi.fn();
const uploaded = vi.fn();
let originalCreate: PropertyDescriptor | undefined;
let originalRevoke: PropertyDescriptor | undefined;

beforeEach(() => {
  fetchMock.mockReset();
  uploaded.mockReset();
  createObjectUrl.mockClear();
  revokeObjectUrl.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  originalCreate = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  originalRevoke = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalCreate) Object.defineProperty(URL, "createObjectURL", originalCreate);
  else delete (URL as Partial<typeof URL>).createObjectURL;
  if (originalRevoke) Object.defineProperty(URL, "revokeObjectURL", originalRevoke);
  else delete (URL as Partial<typeof URL>).revokeObjectURL;
});

function renderUploader() {
  return render(<MediaUploader locale="ja" databaseConfigured storageConfigured onUploaded={uploaded} />);
}

describe("MediaUploader", () => {
  it.each(["image/jpeg", "image/png", "image/webp"])("allows %s files", (mimeType) => {
    renderUploader();
    fireEvent.change(screen.getByLabelText("画像ファイル"), {
      target: { files: [new File(["image"], `asset.${mimeType.split("/")[1]}`, { type: mimeType })] },
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "アップロード" })).toBeEnabled();
  });

  it("previews one selected file and submits multipart FormData without setting Content-Type", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ media: E2E_TEST_DATA.media.landscape }), { status: 201 }),
    );
    renderUploader();
    const file = new File(["image bytes"], "pub-photo.jpg", { type: "image/jpeg" });
    const input = screen.getByLabelText<HTMLInputElement>("画像ファイル");
    fireEvent.change(input, { target: { files: [file] } });
    Object.defineProperty(input, "value", { configurable: true, writable: true, value: "C:\\fakepath\\pub-photo.jpg" });

    expect(await screen.findByAltText("")).toHaveAttribute("src", "blob:local-preview");
    expect(screen.getByText("pub-photo.jpg")).toBeVisible();
    expect(screen.getByText("image/jpeg")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "アップロード" }));

    await waitFor(() => expect(uploaded).toHaveBeenCalledWith(E2E_TEST_DATA.media.landscape));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/media");
    expect(options.method).toBe("POST");
    expect(options.headers).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("file")).toBe(file);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:local-preview");
    expect(screen.queryByText("pub-photo.jpg")).not.toBeInTheDocument();
    expect(input.value).toBe("");
  });

  it("accepts the same file again after a successful upload", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ media: E2E_TEST_DATA.media.landscape }), { status: 201 })),
    );
    renderUploader();
    const input = screen.getByLabelText<HTMLInputElement>("画像ファイル");
    const file = new File(["image bytes"], "pub-photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "アップロード" }));
    await waitFor(() => expect(uploaded).toHaveBeenCalledTimes(1));
    expect(input.value).toBe("");

    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole("button", { name: "アップロード" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "アップロード" }));
    await waitFor(() => expect(uploaded).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects oversized files and unsupported MIME before requesting", () => {
    renderUploader();
    const input = screen.getByLabelText("画像ファイル");
    fireEvent.change(input, {
      target: {
        files: [new File([new Uint8Array(MEDIA_MAX_FILE_SIZE_BYTES + 1)], "large.jpg", { type: "image/jpeg" })],
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("4 MiB以下");
    expect(screen.getByRole("button", { name: "アップロード" })).toBeDisabled();

    fireEvent.change(input, { target: { files: [new File(["x"], "vector.svg", { type: "image/svg+xml" })] } });
    expect(screen.getByRole("alert")).toHaveTextContent("JPEG、PNG、WebP");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("delegates an empty MIME type to server validation", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ errorCode: "media_unsupported_format" }), { status: 415 }),
    );
    renderUploader();
    fireEvent.change(screen.getByLabelText("画像ファイル"), {
      target: { files: [new File(["unknown"], "unknown", { type: "" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "アップロード" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("JPEG、PNG、WebP");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("disables repeat submits while uploading and reports network failures safely", async () => {
    let resolveResponse!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      }),
    );
    renderUploader();
    fireEvent.change(screen.getByLabelText("画像ファイル"), {
      target: { files: [new File(["x"], "a.jpg", { type: "image/jpeg" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "アップロード" }));
    expect(screen.getByRole("button", { name: "アップロード中…" })).toBeDisabled();
    resolveResponse(new Response("provider secret", { status: 500 }));
    expect(await screen.findByRole("alert")).toHaveTextContent("処理中にエラーが発生しました。");

    fetchMock.mockRejectedValueOnce(new Error("private transport detail"));
    fireEvent.click(screen.getByRole("button", { name: "アップロード" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("通信に失敗しました。"));
    expect(screen.queryByText("private transport detail")).not.toBeInTheDocument();
  });
});
