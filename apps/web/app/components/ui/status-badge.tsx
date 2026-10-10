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
  if (!isPublicStatusVisible(status)) return null;

  return (
    <span className={styles.badge} data-status={status}>
      {label}
    </span>
  );
}

/** 公開画面で営業中の状態ラベルを表示しないための判定です。
 * @param status - 店舗の内部営業状態キー。
 * @returns 公開画面に状態ラベルを表示する場合はtrue。
 */
export function isPublicStatusVisible(status: PubStatus) {
  return status !== "open";
}
