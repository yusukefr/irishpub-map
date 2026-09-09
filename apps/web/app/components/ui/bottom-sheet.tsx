"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./ui.module.css";

const STATES = ["collapsed", "medium", "expanded"] as const;
/** Bottom Sheetの段階。地図ジェスチャーや配置は呼び出し側が管理します。 */
export type BottomSheetState = (typeof STATES)[number];
/** 非モーダルのcontrolled Sheet設定です。背景操作の禁止やfocus trapは行いません。 */
export type BottomSheetProps = {
  state: BottomSheetState;
  onStateChange: (state: BottomSheetState) => void;
  title: string;
  resizeLabel: string;
  stateLabels: Record<BottomSheetState, string>;
  children: ReactNode;
};

/**
 * ハンドルのクリック・上下ドラッグ・矢印/Home/Endで高さを変更する非モーダル領域です。
 * @param {BottomSheetProps} props - 表示段階、変更通知、翻訳済みラベルとスクロール内容。
 * @returns safe areaと動的viewportへ対応したSheet。
 */
export function BottomSheet({ state, onStateChange, title, resizeLabel, stateLabels, children }: BottomSheetProps) {
  const id = useId();
  const handleRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const index = STATES.indexOf(state);
  const move = (next: number) => onStateChange(STATES[Math.max(0, Math.min(STATES.length - 1, next))]);

  useEffect(() => {
    // 親から折りたたまれた場合も、非表示になる内容へfocusを残しません。
    if (state === "collapsed" && bodyRef.current?.contains(document.activeElement)) {
      handleRef.current?.focus();
    }
  }, [state]);

  return (
    <section className={styles.sheet} data-state={state} aria-labelledby={`${id}-title`}>
      <button
        ref={handleRef}
        type="button"
        className={styles.sheetHandle}
        aria-label={`${resizeLabel}: ${stateLabels[state]}`}
        aria-controls={`${id}-body`}
        aria-expanded={state !== "collapsed"}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          move((index + 1) % STATES.length);
        }}
        onKeyDown={(event) => {
          suppressClick.current = false;
          const next = { ArrowUp: index + 1, ArrowDown: index - 1, Home: 0, End: 2 }[event.key];
          if (next !== undefined) {
            event.preventDefault();
            move(next);
          }
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          suppressClick.current = false;
          gesture.current = { id: event.pointerId, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          if (gesture.current?.id !== event.pointerId) return;
          const delta = gesture.current.y - event.clientY;
          gesture.current = null;
          // 小さな手ぶれをクリックとして扱い、ドラッグ後の合成clickとの二重更新を防ぎます。
          if (Math.abs(delta) >= 24) {
            suppressClick.current = true;
            move(index + Math.sign(delta));
          }
        }}
        onPointerCancel={() => {
          gesture.current = null;
          suppressClick.current = false;
        }}
        onLostPointerCapture={() => {
          gesture.current = null;
        }}
      >
        <span aria-hidden="true" className={styles.dragHandle} />
      </button>
      <h2 id={`${id}-title`} className={styles.sheetTitle}>
        {title}
      </h2>
      <div
        ref={bodyRef}
        id={`${id}-body`}
        className={styles.sheetBody}
        hidden={state === "collapsed"}
        tabIndex={state === "collapsed" ? undefined : 0}
        role="region"
        aria-label={title}
      >
        {children}
      </div>
    </section>
  );
}
