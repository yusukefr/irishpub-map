"use client";

import type { Pub } from "@irishpub-map/shared/pub";
import { getTagLabel } from "../lib/i18n";
import type { Locale, Translation } from "../lib/i18n";
import { getSafeExternalUrl } from "../lib/external-url";

type PubDetailProps = {
  pub: Pub;
  locale: Locale;
  labels: Pick<
    Translation["list"],
    | "name"
    | "address"
    | "area"
    | "status"
    | "tags"
    | "unset"
    | "officialWebsite"
    | "officialWebsiteNewTab"
    | "externalServiceNewTab"
    | "externalLinksLabel"
    | "serviceLinksLabel"
  > & { statuses: Translation["list"]["statuses"] };
};

/**
 * 選択中店舗の詳細情報と安全な外部リンクを表示します。
 * @param {PubDetailProps} props - 店舗、表示言語、詳細ラベル。
 * @returns {JSX.Element} 店舗詳細ビュー。
 */
export function PubDetail({ pub, locale, labels }: PubDetailProps) {
  return (
    <section className="pub-detail-view" aria-labelledby="pub-detail-heading">
      <h3 id="pub-detail-heading">{pub.name}</h3>
      <span className={["pub-status", statusClass(pub.status)].join(" ")}>
        {pub.statusDisplayName ?? labels.statuses[pub.status]}
      </span>
      <dl>
        <div>
          <dt>{labels.area}</dt>
          <dd>{[pub.prefecture, pub.city].filter(Boolean).join(" / ")}</dd>
        </div>
        <div>
          <dt>{labels.address}</dt>
          <dd>{pub.address}</dd>
        </div>
        <div>
          <dt>{labels.tags}</dt>
          <dd>
            {pub.tags.length > 0
              ? pub.tags.map((tag) => pub.tagDisplayNames?.[tag] ?? getTagLabel(locale, tag)).join(" / ")
              : labels.unset}
          </dd>
        </div>
        <div>
          <dt>{labels.name}</dt>
          <dd>{pub.name}</dd>
        </div>
        <div>
          <dt>{labels.status}</dt>
          <dd>{pub.statusDisplayName ?? labels.statuses[pub.status]}</dd>
        </div>
      </dl>
      <ExternalLinks pub={pub} labels={labels} />
    </section>
  );
}

function statusClass(status: Pub["status"]) {
  return {
    open: "pub-status-open",
    temporarily_closed: "pub-status-temporarily-closed",
    closed: "pub-status-closed",
    unknown: "pub-status-unknown",
  }[status];
}

function ExternalLinks({ pub, labels }: { pub: Pub; labels: PubDetailProps["labels"] }) {
  const links = [
    createLink(pub.websiteUrl, labels.officialWebsiteNewTab.replace("{name}", pub.name), labels.officialWebsite),
    createLink(
      pub.googleMapsUrl,
      labels.externalServiceNewTab.replace("{name}", pub.name).replace("{service}", "Google Maps"),
      "Google Maps",
    ),
    createLink(
      pub.instagramUrl,
      labels.externalServiceNewTab.replace("{name}", pub.name).replace("{service}", "Instagram"),
      "Instagram",
    ),
  ].filter((link): link is { href: string; label: string; text: string } => link !== null);

  return links.length > 0 ? (
    <div className="pub-detail-links" aria-label={labels.externalLinksLabel.replace("{name}", pub.name)}>
      {links.map((link) => (
        <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" aria-label={link.label}>
          {link.text}
        </a>
      ))}
    </div>
  ) : null;
}

function createLink(value: string | null | undefined, label: string, text: string) {
  const href = getSafeExternalUrl(value);

  return href ? { href, label, text } : null;
}
