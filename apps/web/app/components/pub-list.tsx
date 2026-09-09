"use client";

import type { Pub } from "@irishpub-map/shared/pub";
import { DEFAULT_LOCALE, formatMessage, getTranslation } from "../lib/i18n";
import { PubCard } from "./ui/pub-card";
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
        {pubs.map((pub) => (
          <PubCard
            key={pub.id}
            pub={pub}
            locale={locale}
            selected={selectedPubId === pub.id}
            onSelect={onSelectPub}
            onShowDetails={onShowDetails}
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
          />
        ))}
      </div>
    </div>
  );
}
