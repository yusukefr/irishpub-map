"use client";

import { useState, type ReactNode } from "react";
import type { Pub, PubStatus } from "@irishpub-map/shared/pub";
import { formatMessage, getTagLabel, getTranslation } from "../lib/i18n";
import type { Locale } from "../lib/i18n";

type PubListProps = {
  pubs: Pub[];
  selectedPubId?: string | null;
  onSelectPub?: (pubId: string) => void;
  locale?: Locale;
};

const STATUS_BADGE_CLASSES: Record<PubStatus, string> = {
  open: "pub-status-open",
  temporarily_closed: "pub-status-temporarily-closed",
  closed: "pub-status-closed",
  unknown: "pub-status-unknown",
};

/**
 * 絞り込み済み店舗をカード表示し、選択状態を地図と共有します。
 * @param {{ pubs: Pub[]; selectedPubId?: string | null; onSelectPub?: (pubId: string) => void }} root0 - 一覧表示の状態。
 * @param {Pub[]} root0.pubs - 表示する店舗一覧。
 * @param {string | null | undefined} root0.selectedPubId - 選択中の店舗ID。
 * @param {(pubId: string) => void} root0.onSelectPub - 店舗選択時のコールバック。
 * @returns {JSX.Element} 店舗カード一覧。
 */
export function PubList({ pubs, selectedPubId = null, onSelectPub = () => undefined, locale = "ja" }: PubListProps) {
  const t = getTranslation(locale);
  const [expandedPubId, setExpandedPubId] = useState<string | null>(null);

  const togglePubDetails = (pubId: string) => {
    onSelectPub(pubId);
    setExpandedPubId((currentPubId) => (currentPubId === pubId ? null : pubId));
  };

  return (
    <aside className="pub-list" aria-label={t.explorer.mapAndListLabel}>
      <div className="list-header">
        <div>
          <p className="section-kicker">{t.list.kicker}</p>
          <h2>{t.list.heading}</h2>
        </div>
        <span className="list-count">{formatMessage(t.list.count, { count: pubs.length })}</span>
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
                isSelected ? "pub-card-selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
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
                  {pub.statusDisplayName ?? t.list.statuses[pub.status]}
                </span>
              </div>
              {pub.tags.length > 0 ? (
                <ul className="pub-tags" aria-label={formatMessage(t.list.pubTagsLabel, { name: pub.name })}>
                  {pub.tags.map((tag) => (
                    <li key={tag}>{pub.tagDisplayNames?.[tag] ?? getTagLabel(locale, tag)}</li>
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
                  {isExpanded ? t.list.close : t.list.details}
                </button>
                <div className="pub-links">
                  {pub.websiteUrl ? <WebsiteLink href={pub.websiteUrl} pubName={pub.name} locale={locale} /> : null}
                  <ExternalServiceLinks pub={pub} locale={locale} />
                </div>
              </div>
              {isExpanded ? <PubDetails pub={pub} detailsId={detailsId} locale={locale} /> : null}
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
  locale: Locale;
};

function PubDetails({ pub, detailsId, locale }: PubDetailsProps) {
  const t = getTranslation(locale);
  return (
    <section
      className="pub-details"
      id={detailsId}
      aria-label={formatMessage(t.list.pubDetailsLabel, { name: pub.name })}
    >
      <dl>
        <div>
          <dt>{t.list.name}</dt>
          <dd>{pub.name}</dd>
        </div>
        <div>
          <dt>{t.list.address}</dt>
          <dd>{pub.address}</dd>
        </div>
        <div>
          <dt>{t.list.area}</dt>
          <dd>{[pub.prefecture, pub.city].filter(Boolean).join(" / ")}</dd>
        </div>
        <div>
          <dt>{t.list.status}</dt>
          <dd>{pub.statusDisplayName ?? t.list.statuses[pub.status]}</dd>
        </div>
        <div>
          <dt>{t.list.tags}</dt>
          <dd>
            {pub.tags.length > 0
              ? pub.tags.map((tag) => pub.tagDisplayNames?.[tag] ?? getTagLabel(locale, tag)).join(" / ")
              : t.list.unset}
          </dd>
        </div>
      </dl>
      <div className="pub-detail-links" aria-label={formatMessage(t.list.externalLinksLabel, { name: pub.name })}>
        {pub.websiteUrl ? <WebsiteLink href={pub.websiteUrl} pubName={pub.name} locale={locale} /> : null}
        <ExternalServiceLinks pub={pub} locale={locale} />
      </div>
    </section>
  );
}

function ExternalServiceLinks({ pub, locale }: { pub: Pub; locale: Locale }) {
  if (!pub.googleMapsUrl && !pub.instagramUrl) {
    return null;
  }

  return (
    <div
      className="pub-service-links"
      role="group"
      aria-label={formatMessage(getTranslation(locale).list.serviceLinksLabel, { name: pub.name })}
    >
      {pub.googleMapsUrl ? (
        <ExternalIconLink
          href={pub.googleMapsUrl}
          pubName={pub.name}
          locale={locale}
          service="Google Maps"
          className="google-maps-link"
        >
          <MapPinIcon />
        </ExternalIconLink>
      ) : null}
      {pub.instagramUrl ? (
        <ExternalIconLink
          href={pub.instagramUrl}
          pubName={pub.name}
          locale={locale}
          service="Instagram"
          className="instagram-link"
        >
          <InstagramIcon />
        </ExternalIconLink>
      ) : null}
    </div>
  );
}

type ExternalLinkProps = {
  href: string;
  pubName: string;
  locale: Locale;
};

function WebsiteLink({ href, pubName, locale }: ExternalLinkProps) {
  const t = getTranslation(locale);
  return (
    <a
      className="external-text-link"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={formatMessage(t.list.officialWebsiteNewTab, { name: pubName })}
      onClick={(event) => event.stopPropagation()}
    >
      {t.list.officialWebsite}
      <ExternalLinkIcon />
    </a>
  );
}

type ExternalIconLinkProps = ExternalLinkProps & {
  service: "Google Maps" | "Instagram";
  className: string;
  children: ReactNode;
};

function ExternalIconLink({ href, pubName, locale, service, className, children }: ExternalIconLinkProps) {
  const t = getTranslation(locale);
  return (
    <a
      className={`external-icon-link ${className}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={formatMessage(t.list.externalServiceNewTab, { name: pubName, service })}
      title={service}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </a>
  );
}

function ExternalLinkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M20 10c0 5-8 10-8 10S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.8" r="1" className="icon-fill" />
    </svg>
  );
}
