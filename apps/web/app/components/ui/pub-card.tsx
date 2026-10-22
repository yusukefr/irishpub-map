import type { ComponentPropsWithRef, ReactNode } from "react";
import type { Pub } from "@irishpub-map/shared/pub";
import { DEFAULT_LOCALE, formatMessage, getTagLabel, getTranslation, type Locale } from "../../lib/i18n";
import { Button } from "./button";
import { StatusBadge, isPublicStatusVisible } from "./status-badge";
import styles from "./ui.module.css";

/** 一覧と地図で共有する店舗表示。写真・距離は表示専用でDB形式を変更しません。 */
export type PubCardProps = {
  pub: Pub;
  locale?: Locale;
  selected?: boolean;
  density?: "comfortable" | "compact";
  onSelect: (pubId: string) => void;
  onShowDetails?: (pubId: string) => void;
  media?: ReactNode;
  metadata?: ReactNode;
  distance?: string;
  ref?: ComponentPropsWithRef<"article">["ref"];
};

/**
 * 店名→地域→状態→補助情報→距離→タグ→詳細の順で店舗情報を表示します。
 * @param {PubCardProps} props - 店舗、選択操作、任意の表示専用情報。
 * @returns 地図との選択連携を持つ店舗カード。
 */
export function PubCard({
  pub,
  locale = DEFAULT_LOCALE,
  selected = false,
  density = "comfortable",
  onSelect,
  onShowDetails,
  media,
  metadata,
  distance,
  ref,
}: PubCardProps) {
  const t = getTranslation(locale).list;
  const tags = pub.tags.slice(0, 2);
  const additionalCount = pub.tags.length - tags.length;
  const locationLabel = [pub.prefecture, pub.city].filter(Boolean).join(" / ");
  const statusLabel = pub.statusDisplayName ?? t.statuses[pub.status];
  const pubTypeLabel = pub.pubTypeDisplayName ?? pub.pubType;
  // 視覚的なラベルを同じ順序で含め、音声操作とスクリーンリーダーの呼称を一致させます。
  const accessibleName = [
    formatMessage(t.selectPub, { name: pub.name }),
    locationLabel,
    ...(isPublicStatusVisible(pub.status) ? [statusLabel] : []),
    pubTypeLabel,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <article
      ref={ref}
      className={styles.pubCard}
      data-selected={selected || undefined}
      data-status={pub.status}
      data-density={density}
    >
      {media ? <div className={styles.cardMedia}>{media}</div> : null}
      <button
        type="button"
        className={styles.pubSelect}
        aria-pressed={selected}
        aria-label={accessibleName}
        onClick={() => onSelect(pub.id)}
      >
        <span className={styles.pubName} role="heading" aria-level={3}>
          {pub.name}
        </span>
        <span className={styles.metadata}>{locationLabel}</span>
        <StatusBadge status={pub.status} label={statusLabel} />
        <span className="pub-type-label">{pubTypeLabel}</span>
      </button>
      {metadata ? <div className={styles.metadata}>{metadata}</div> : null}
      {distance ? <p className={styles.metadata}>{distance}</p> : null}
      {tags.length ? (
        <ul className={styles.tags} aria-label={formatMessage(t.pubTagsLabel, { name: pub.name })}>
          {tags.map((tag) => (
            <li key={tag}>{pub.tagDisplayNames?.[tag] ?? getTagLabel(locale, tag)}</li>
          ))}
          {additionalCount > 0 ? <li>+{additionalCount}</li> : null}
        </ul>
      ) : null}
      {onShowDetails ? (
        <Button variant="ghost" onClick={() => onShowDetails(pub.id)}>
          {t.details}
        </Button>
      ) : null}
    </article>
  );
}
