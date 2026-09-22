import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareButton } from "../../apps/web/app/components/share-button";
import { getGuideUrl, getPubUrl } from "../../apps/web/app/lib/public-url";

const share = vi.fn();
const writeText = vi.fn();
const props = {
  title: "Sample Pub",
  text: "Sample Pub | Irish Pub Map",
  url: getPubUrl("sample"),
  locale: "ja" as const,
};

beforeEach(() => {
  share.mockReset().mockResolvedValue(undefined);
  writeText.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { share, clipboard: { writeText } });
});
afterEach(() => vi.unstubAllGlobals());

describe("ShareButton", () => {
  it("shares only the supplied public payload and prevents duplicate operations", async () => {
    let finish!: () => void;
    share.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    render(<ShareButton {...props} />);
    const button = screen.getByRole("button", { name: "共有する" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(share).toHaveBeenCalledExactlyOnceWith({ title: props.title, text: props.text, url: props.url });
    await act(async () => finish());
    expect(button).toBeEnabled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("shares a content title and URL without optional text", async () => {
    render(<ShareButton title="Guide" url={getGuideUrl("sample")} locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(share).toHaveBeenCalledExactlyOnceWith({ title: "Guide", url: getGuideUrl("sample") }));
  });

  it.each(["Cancelled", "No share targets"])("offers copy silently after AbortError: %s", async (reason) => {
    share.mockRejectedValue(new DOMException(reason, "AbortError"));
    render(<ShareButton {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "共有する" }));
    const copy = await screen.findByRole("button", { name: "URLをコピー" });
    expect(copy).toBeEnabled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(copy);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("URLをコピーしました"));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(props.url);
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("offers a separate copy action after a sharing failure", async () => {
    share.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
    render(<ShareButton {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "共有する" }));
    const copy = await screen.findByRole("button", { name: "URLをコピー" });
    expect(screen.getByRole("status")).toHaveTextContent("共有できませんでした");
    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(copy);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("URLをコピーしました"));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(props.url);
  });

  it("copies the public URL when Web Share is unavailable", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<ShareButton {...props} locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy URL" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("URL copied."));
    expect(writeText).toHaveBeenCalledExactlyOnceWith(props.url);
  });

  it.each(["unavailable", "denied"])("provides a selectable URL when clipboard is %s", async (condition) => {
    writeText.mockRejectedValue(new Error("Denied"));
    vi.stubGlobal("navigator", condition === "unavailable" ? {} : { clipboard: { writeText } });
    render(<ShareButton {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "URLをコピー" }));
    const input = await screen.findByRole("textbox", { name: "共有用URL" });
    expect(input).toHaveValue(props.url);
    fireEvent.focus(input);
    expect((input as HTMLInputElement).selectionEnd).toBe(props.url.length);
  });
});

it("encodes public identifiers without adopting paths or query parameters", () => {
  expect(new URL(getPubUrl("sample&admin=true")).searchParams.get("pub")).toBe("sample&admin=true");
  expect(new URL(getPubUrl("sample")).origin).toBe("https://irishpub-map-web.vercel.app");
  expect(getGuideUrl("sample/?draft=true")).toBe(
    "https://irishpub-map-web.vercel.app/discover/guides/sample%2F%3Fdraft%3Dtrue",
  );
});
