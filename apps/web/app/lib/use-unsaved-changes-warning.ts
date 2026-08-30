import { useEffect, useRef } from "react";

type UnsavedChangesWarningOptions = {
  isDirty: boolean;
  message: string;
};

/**
 * 編集途中のブラウザ離脱と同一アプリ内リンク遷移を確認します。
 * @param {UnsavedChangesWarningOptions} options - 警告の有効条件と表示文言。
 * @param {boolean} options.isDirty - 保存済み状態から変更されているかどうか。
 * @param {string} options.message - 利用者へ確認する文言。
 * @returns {void} 警告イベントを登録します。
 */
export function useUnsavedChangesWarning({ isDirty, message }: UnsavedChangesWarningOptions): void {
  const skipNextBeforeUnloadRef = useRef(false);
  const resetSkipTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (skipNextBeforeUnloadRef.current) {
        skipNextBeforeUnloadRef.current = false;
        if (resetSkipTimerRef.current !== null) {
          window.clearTimeout(resetSkipTimerRef.current);
          resetSkipTimerRef.current = null;
        }
        return;
      }
      event.preventDefault();
      event.returnValue = message;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (anchor.origin !== window.location.origin || anchor.href === window.location.href) return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      skipNextBeforeUnloadRef.current = true;
      resetSkipTimerRef.current = window.setTimeout(() => {
        skipNextBeforeUnloadRef.current = false;
        resetSkipTimerRef.current = null;
      }, 0);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
      if (resetSkipTimerRef.current !== null) {
        window.clearTimeout(resetSkipTimerRef.current);
        resetSkipTimerRef.current = null;
      }
    };
  }, [isDirty, message]);
}
