"use client";

import type { Pub, PubStatus } from "@irishpub-map/shared/pub";
import { DEFAULT_LOCALE, formatMessage, getTagLabel, getTranslation } from "../lib/i18n";
import type { MutableRefObject } from "react";
import type { Locale } from "../lib/i18n";

type PubListProps = {
  pubs: Pub[];
  selectedPubId?: string | null;
  onSelectPub?: (pubId: string) => void;
  onShowDetails?: (pubId: string) => void;
  resultRefs?: MutableRefObject<Map<string, HTMLElement>>;
  locale?: Locale;
  hideHeader?: boolean;
};

const STATUS_BADGE_CLASSES: Record<PubStatus, string> = {
  open: "pub-status-open",
  temporarily_closed: "pub-status-temporarily-closed",
  closed: "pub-status-closed",
  unknown: "pub-status-unknown",
};

/**
 * 絞り込み済み店舗をコンパクトな選択カードで表示します。
 * @param {PubListProps} props - 一覧、選択状態、詳細表示の操作設定。
 * @returns {JSX.Element} 店舗結果一覧。
 */
export function PubList({
  pubs,
  selectedPubId = null,
  onSelectPub = () => undefined,
  onShowDetails,
  resultRefs,
  locale = DEFAULT_LOCALE,
  hideHeader = false,
}: PubListProps) {
  const t = getTranslation(locale);

  return (
    <div className="pub-list" aria-label={t.explorer.mapAndListLabel}>
      {!hideHeader ? (
        <div className="list-header">
          <div>
            <p className="section-kicker">{t.list.kicker}</p>
            <h2>{t.list.heading}</h2>
          </div>
          <span className="list-count">{formatMessage(t.list.count, { count: pubs.length })}</span>
        </div>
      ) : null}
      <div className="pub-items">
        {pubs.map((pub) => {
          const isSelected = selectedPubId === pub.id;
          const visibleTags = pub.tags.slice(0, 2);
          const additionalTagCount = Math.max(pub.tags.length - visibleTags.length, 0);

          return (
            <article
              className={[
                "pub-card",
                "pub-card-compact",
                pub.status === "closed" ? "pub-card-closed" : "",
                isSelected ? "pub-card-selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-selected={isSelected || undefined}
              key={pub.id}
              ref={(element) => {
                if (!resultRefs) {
                  return;
                }

                if (element) {
                  resultRefs.current.set(pub.id, element);
                } else {
                  resultRefs.current.delete(pub.id);
                }
              }}
            >
              <button
                type="button"
                className="pub-result-select"
                aria-pressed={isSelected}
                aria-label={formatMessage(t.list.selectPub, { name: pub.name })}
                onClick={() => onSelectPub(pub.id)}
              >
                <span className="pub-result-main">
                  <span className="pub-result-name" role="heading" aria-level={3}>
                    {pub.name}
                  </span>
                  <span>{[pub.prefecture, pub.city].filter(Boolean).join(" / ")}</span>
                </span>
                <span className={["pub-status", STATUS_BADGE_CLASSES[pub.status]].join(" ")}>
                  {pub.statusDisplayName ?? t.list.statuses[pub.status]}
                </span>
              </button>
              {visibleTags.length > 0 ? (
                <ul className="pub-tags" aria-label={formatMessage(t.list.pubTagsLabel, { name: pub.name })}>
                  {visibleTags.map((tag) => (
                    <li key={tag}>{pub.tagDisplayNames?.[tag] ?? getTagLabel(locale, tag)}</li>
                  ))}
                  {additionalTagCount > 0 ? <li>+{additionalTagCount}</li> : null}
                </ul>
              ) : null}
              {onShowDetails ? (
                <button type="button" className="pub-detail-toggle" onClick={() => onShowDetails(pub.id)}>
                  {t.list.details}
                </button>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
