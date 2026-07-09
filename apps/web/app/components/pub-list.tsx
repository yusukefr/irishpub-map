"use client";

import { useState } from "react";
import type { Pub, PubStatus } from "@irishpub-map/shared/pub";

type PubListProps = {
  pubs: Pub[];
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

export function PubList({ pubs }: PubListProps) {
  const [selectedPubId, setSelectedPubId] = useState<string | null>(null);

  const togglePubDetails = (pubId: string) => {
    setSelectedPubId((currentPubId) => (currentPubId === pubId ? null : pubId));
  };

  return (
    <aside className="pub-list" aria-label="Irish Pub list">
      <div className="list-header">
        <h2>掲載店舗</h2>
        <span>{pubs.length}件</span>
      </div>
      <div className="pub-items">
        {pubs.map((pub) => {
          const detailsId = `pub-details-${pub.id}`;
          const isSelected = selectedPubId === pub.id;

          return (
            <article className={pub.status === "closed" ? "pub-card pub-card-closed" : "pub-card"} key={pub.id}>
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
                <ul className="pub-tags" aria-label={pub.name + " tags"}>
                  {pub.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              ) : null}
              <div className="pub-actions">
                <button
                  type="button"
                  className="pub-detail-toggle"
                  aria-expanded={isSelected}
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
              {isSelected ? <PubDetails pub={pub} detailsId={detailsId} /> : null}
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
          <dd>{pub.tags.length > 0 ? pub.tags.join(" / ") : "未設定"}</dd>
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
