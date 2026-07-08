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
  return (
    <aside className="pub-list" aria-label="Irish Pub list">
      <div className="list-header">
        <h2>掲載店舗</h2>
        <span>{pubs.length}件</span>
      </div>
      <div className="pub-items">
        {pubs.map((pub) => (
          <article className="pub-card" key={pub.id}>
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
          </article>
        ))}
      </div>
    </aside>
  );
}
