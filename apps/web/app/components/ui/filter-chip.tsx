import type { ComponentPropsWithRef, ReactNode } from "react";
import { Icon } from "./ui-icon";
import styles from "./ui.module.css";

/** 選択状態をpressedで公開するフィルター操作です。 */
export type FilterChipProps = Omit<ComponentPropsWithRef<"button">, "aria-pressed"> & { selected?: boolean };

/**
 * 選択を色・check・pressed状態で示すpill型ボタンです。
 * @param {FilterChipProps} props - 選択、disabled、操作通知、ラベル。
 * @returns Filter chip。
 */
export function FilterChip({ selected = false, className = "", type = "button", children, ...props }: FilterChipProps) {
  return (
    <button {...props} type={type} className={`${styles.chip} ${className}`} aria-pressed={selected}>
      <span className={styles.chipCheck} aria-hidden="true">
        {selected ? <Icon name="check" /> : null}
      </span>
      <span>{children}</span>
    </button>
  );
}

/**
 * 多数のフィルターを横スクロールできる名前付き領域へまとめます。
 * @param props - 領域ラベルとchip。
 * @param props.label - 領域の読み上げ名。
 * @param props.children - フィルター操作。
 * @returns 横スクロール領域。
 */
export function FilterChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.chipGroup} role="group" aria-label={label}>
      {children}
    </div>
  );
}
