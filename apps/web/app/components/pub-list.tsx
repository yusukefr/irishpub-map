"use client";

import { useState } from "react";
import type { Pub, PubStatus } from "@irishpub-map/shared/pub";
import { getTagLabel } from "@irishpub-map/shared/tag";

type PubListProps = {
  pubs: Pub[];
  selectedPubId?: string | null;
  onSelectPub?: (pubId: string) => void;
};

const STATUS_LABELS: Record<PubStatus, string> = {
  open: "営業中",
  temporarily_closed: "一時休業",
  closed: "閉業",
  unknown: "不明"
};

const STATUS_BADGE_CLASSES: Record<PubStatus, string> = {
  open: "pub-status-open",
  temporarily_closed: "pub-status-temporarily-closed",
  closed: "pub-status-closed",
  unknown: "pub-status-unknown"
};

/** 絞り込み済み店舗をカード表示し、選択状態を地図と共有します。 */
export function PubList({ pubs, selectedPubId = null, onSelectPub = () => undefined }: PubListProps) {
  const [expandedPubId, setExpandedPubId] = useState<string | null>(null);

  const togglePubDetails = (pubId: string) => {
    onSelectPub(pubId);
    setExpandedPubId((currentPubId) => (currentPubId === pubId ? null : pubId));
  };

  return (
    <aside className="pub-list" aria-label="Irish Pub list">
      <div className="list-header">
        <div>
          <p className="section-kicker">Search results</p>
          <h2>掲載店舗</h2>
        </div>
        <span className="list-count">{pubs.length}件</span>
      </div>
      <div className="pub-items">
        {pubs.map((pub) => {
          const detailsId = `pub-details-${pub.id}`;
          const isSelected = selectedPubId === pub.id;
          const isExpanded = expandedPubId === pub.id;

          return (
            <article
              className={[
                "pub-card",
                pub.status === "closed" ? "pub-card-closed" : "",
                isSelected ? "pub-card-selected" : ""
              ].filter(Boolean).join(" ")}
              data-selected={isSelected || undefined}
              key={pub.id}
              onClick={() => onSelectPub(pub.id)}
            >
              <div className="pub-card-header">
                <div>
                  <h3>{pub.name}</h3>
                  <p>{[pub.prefecture, pub.city].filter(Boolean).join(" / ")}</p>
                </div>
                <span className={["pub-status", STATUS_BADGE_CLASSES[pub.status]].join(" ")}>
                  {STATUS_LABELS[pub.status]}
                </span>
              </div>
              {pub.tags.length > 0 ? (
                <ul className="pub-tags" aria-label={`${pub.name} のタグ`}>
                  {pub.tags.map((tag) => (
                    <li key={tag}>{getTagLabel(tag)}</li>
                  ))}
                </ul>
              ) : null}
              <div className="pub-actions">
                <button
                  type="button"
                  className="pub-detail-toggle"
                  aria-expanded={isExpanded}
                  aria-controls={detailsId}
                  onClick={() => togglePubDetails(pub.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      togglePubDetails(pub.id);
                    }
                  }}
                >
                  詳細
                </button>
                <div className="pub-links">
                  {pub.websiteUrl ? (
                    <a href={pub.websiteUrl} target="_blank" rel="noreferrer">
                      公式サイト
                    </a>
                  ) : null}
                  {pub.googleMapsUrl ? (
                    <a href={pub.googleMapsUrl} target="_blank" rel="noreferrer">
                      Google Maps
                    </a>
                  ) : null}
                </div>
              </div>
              {isExpanded ? <PubDetails pub={pub} detailsId={detailsId} /> : null}
            </article>
          );
        })}
      </div>
    </aside>
  );
}

type PubDetailsProps = {
  pub: Pub;
  detailsId: string;
};

function PubDetails({ pub, detailsId }: PubDetailsProps) {
  return (
    <section className="pub-details" id={detailsId} aria-label={`${pub.name} の詳細`}>
      <dl>
        <div>
          <dt>店舗名</dt>
          <dd>{pub.name}</dd>
        </div>
        <div>
          <dt>住所</dt>
          <dd>{pub.address}</dd>
        </div>
        <div>
          <dt>エリア</dt>
          <dd>{[pub.prefecture, pub.city].filter(Boolean).join(" / ")}</dd>
        </div>
        <div>
          <dt>営業状況</dt>
          <dd>{STATUS_LABELS[pub.status]}</dd>
        </div>
        <div>
          <dt>タグ</dt>
          <dd>{pub.tags.length > 0 ? pub.tags.map(getTagLabel).join(" / ") : "未設定"}</dd>
        </div>
      </dl>
      <div className="pub-detail-links" aria-label={`${pub.name} external links`}>
        {pub.websiteUrl ? (
          <a href={pub.websiteUrl} target="_blank" rel="noreferrer">
            公式サイト
          </a>
        ) : null}
        {pub.googleMapsUrl ? (
          <a href={pub.googleMapsUrl} target="_blank" rel="noreferrer">
            Google Maps
          </a>
        ) : null}
        {pub.instagramUrl ? (
          <a href={pub.instagramUrl} target="_blank" rel="noreferrer">
            Instagram
          </a>
        ) : null}
      </div>
    </section>
  );
}
