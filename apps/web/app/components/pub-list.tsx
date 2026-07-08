import type { Pub } from "@irishpub-map/shared/pub";

type PubListProps = {
  pubs: Pub[];
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
          <article className={pub.status === "closed" ? "pub-card pub-card-closed" : "pub-card"} key={pub.id}>
            <div>
              <h3>{pub.name}</h3>
              <p>{[pub.prefecture, pub.city].filter(Boolean).join(" / ")}</p>
            </div>
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
