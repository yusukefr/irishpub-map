import type { ReactNode } from "react";
import styles from "./ui.module.css";

/** 店舗選択ではなく記事・ガイドへの入口を表すカード設定です。 */
export type ContentCardProps = {
  titleId: string;
  title: string;
  description?: string;
  eyebrow?: string;
  media?: ReactNode;
  metadata?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  variant?: "default" | "feature" | "compact";
};

/**
 * 見出しIDを呼び出し側から受け取り、Server Componentのまま記事を構成します。
 * @param {ContentCardProps} props - 記事見出し、任意の画像・説明・操作と表示の役割。
 * @returns 記事用の共通カード。
 */
export function ContentCard({
  titleId,
  title,
  description,
  eyebrow,
  media,
  metadata,
  action,
  children,
  variant = "default",
}: ContentCardProps) {
  return (
    <section className={styles.contentCard} data-variant={variant} aria-labelledby={titleId}>
      {media ? <div className={styles.cardMedia}>{media}</div> : null}
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h2 id={titleId}>{title}</h2>
      {description ? <p>{description}</p> : null}
      {metadata ? <div className={styles.metadata}>{metadata}</div> : null}
      {children}
      {action ? <div className={styles.cardAction}>{action}</div> : null}
    </section>
  );
}
