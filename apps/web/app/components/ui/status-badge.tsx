import type { PubStatus } from "@irishpub-map/shared/pub";
import styles from "./ui.module.css";

/**
 * 営業状態をSemantic Colorと翻訳済みラベルで示します。
 * @param props - 営業状態と必須の表示文字。
 * @param props.status - 営業状態。
 * @param props.label - 翻訳済み表示文字。
 * @returns 操作ではない状態表示。
 */
export function StatusBadge({ status, label }: { status: PubStatus; label: string }) {
  return (
    <span className={styles.badge} data-status={status}>
      {label}
    </span>
  );
}
