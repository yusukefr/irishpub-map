// 非モーダルSheetの状態遷移・隠れる内容のfocus・pointer/keyboard代替操作を保証します。
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BottomSheet, type BottomSheetState } from "../../apps/web/app/components/ui/bottom-sheet";

const labels = { collapsed: "折りたたみ", medium: "中間", expanded: "展開" };
function Demo() {
  const [state, setState] = useState<BottomSheetState>("medium");
  return (
    <BottomSheet title="結果" resizeLabel="高さ" stateLabels={labels} state={state} onStateChange={setState}>
      <button onClick={() => setState("collapsed")}>内側から折りたたむ</button>
    </BottomSheet>
  );
}
function pointer(
  element: HTMLElement,
  type: string,
  y: number,
  options: { id?: number; button?: number; primary?: boolean } = {},
) {
  // jsdomではPointerEventがないため、実イベントと同じ読み取り属性を定義します。
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    pointerId: { value: options.id ?? 1 },
    clientY: { value: y },
    isPrimary: { value: options.primary ?? true },
    button: { value: options.button ?? 0 },
  });
  fireEvent(element, event);
}

describe("BottomSheet", () => {
  it("cycles states, clamps arrow movement and leaves Tab navigation intact", () => {
    render(<Demo />);
    const handle = screen.getByRole("button", { name: "高さ: 中間" });
    fireEvent.click(handle);
    expect(handle).toHaveAccessibleName("高さ: 展開");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(handle).toHaveAccessibleName("高さ: 展開");
    fireEvent.click(handle);
    expect(handle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "内側から折りたたむ" })).not.toBeInTheDocument();
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(handle).toHaveAccessibleName("高さ: 折りたたみ");
    fireEvent.keyDown(handle, { key: "End" });
    expect(handle).toHaveAccessibleName("高さ: 展開");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(handle).toHaveAccessibleName("高さ: 中間");
    fireEvent.keyDown(handle, { key: "Home" });
    expect(handle).toHaveAccessibleName("高さ: 折りたたみ");
    expect(fireEvent.keyDown(handle, { key: "Tab" })).toBe(true);
  });

  it("moves focus from collapsed content to the handle, without stealing outside focus", () => {
    render(
      <>
        <button>外側</button>
        <Demo />
      </>,
    );
    const inside = screen.getByRole("button", { name: "内側から折りたたむ" });
    inside.focus();
    fireEvent.click(inside);
    expect(screen.getByRole("button", { name: "高さ: 折りたたみ" })).toHaveFocus();
    const outside = screen.getByRole("button", { name: "外側" });
    outside.focus();
    expect(outside).toHaveFocus();
  });

  it("handles up/down drag, ignores small movements and prevents the synthetic click from cycling twice", () => {
    render(<Demo />);
    const handle = screen.getByRole("button", { name: "高さ: 中間" });
    handle.setPointerCapture = vi.fn();
    pointer(handle, "pointerdown", 100);
    pointer(handle, "pointerup", 50);
    fireEvent.click(handle);
    expect(handle).toHaveAccessibleName("高さ: 展開");
    expect(handle.setPointerCapture).toHaveBeenCalledWith(1);
    pointer(handle, "pointerdown", 50);
    pointer(handle, "pointerup", 100);
    fireEvent.click(handle);
    expect(handle).toHaveAccessibleName("高さ: 中間");
    pointer(handle, "pointerdown", 50);
    pointer(handle, "pointerup", 55);
    fireEvent.click(handle);
    expect(handle).toHaveAccessibleName("高さ: 展開");
  });

  it("ignores secondary pointers, unrelated pointer-up and cancelled or lost gestures", () => {
    render(<Demo />);
    const handle = screen.getByRole("button", { name: "高さ: 中間" });
    handle.setPointerCapture = vi.fn();
    pointer(handle, "pointerup", 0);
    pointer(handle, "pointerdown", 100, { primary: false });
    pointer(handle, "pointerup", 0);
    pointer(handle, "pointerdown", 100, { button: 2 });
    pointer(handle, "pointerup", 0);
    expect(handle.setPointerCapture).not.toHaveBeenCalled();
    pointer(handle, "pointerdown", 100);
    pointer(handle, "pointerup", 0, { id: 2 });
    pointer(handle, "pointercancel", 0);
    pointer(handle, "pointerup", 0);
    expect(handle).toHaveAccessibleName("高さ: 中間");
    pointer(handle, "pointerdown", 100);
    pointer(handle, "lostpointercapture", 0);
    pointer(handle, "pointerup", 0);
    expect(handle).toHaveAccessibleName("高さ: 中間");
  });
});
