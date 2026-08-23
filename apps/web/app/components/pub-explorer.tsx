"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Pub } from "@irishpub-map/shared/pub";
import { formatMessage, getTagLabel, getTranslation, type Locale } from "../lib/i18n";
import {
  filterPubs,
  getAvailablePrefectures,
  getAvailableTags,
  getNearestAvailablePrefecture,
  type Coordinates,
} from "../lib/pub-search";
import { PubList } from "./pub-list";
import { PubMap } from "./pub-map";

type PubExplorerProps = {
  pubs: Pub[];
  locale?: Locale;
};

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 300000,
  timeout: 5000,
};

const EMPTY_FOCUS_PUBS: Pub[] = [];

type GeolocationStatus = "idle" | "requesting" | "success" | "no-pubs" | "denied" | "error" | "unsupported";

/**
 * 検索条件、地図、店舗一覧で共有する探索状態を一元管理します。
 * @param {{ pubs: Pub[] }} root0 - 探索対象の店舗一覧。
 * @param {Pub[]} root0.pubs - 検索対象の店舗一覧。
 * @returns {JSX.Element} 検索・地図・一覧を組み合わせた探索画面。
 */
export function PubExplorer({ pubs, locale = "ja" }: PubExplorerProps) {
  const t = getTranslation(locale);
  const [query, setQuery] = useState("");
  const [selectedPrefecture, setSelectedPrefecture] = useState("");
  const [currentPrefecture, setCurrentPrefecture] = useState("");
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [geolocationStatus, setGeolocationStatus] = useState<GeolocationStatus>("idle");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [selectedPubId, setSelectedPubId] = useState<string | null>(null);
  const hasSelectedPrefecture = useRef(false);
  const isMounted = useRef(true);
  const availablePrefectures = useMemo(() => getAvailablePrefectures(pubs), [pubs]);
  const availableTags = useMemo(() => getAvailableTags(pubs), [pubs]);
  const filteredPubs = useMemo(
    () => filterPubs(pubs, { query, prefecture: selectedPrefecture, tags: selectedTags, includeClosed }),
    [pubs, query, selectedPrefecture, selectedTags, includeClosed],
  );
  const prefecturePubs = useMemo(
    () => (selectedPrefecture ? filterPubs(pubs, { prefecture: selectedPrefecture, includeClosed }) : []),
    [pubs, selectedPrefecture, includeClosed],
  );
  const mapFocusPubs = selectedPrefecture === currentPrefecture ? EMPTY_FOCUS_PUBS : prefecturePubs;
  const hasActiveFilters = Boolean(query || selectedPrefecture || selectedTags.length || includeClosed);
  const detailedFilterCount = Number(Boolean(selectedPrefecture)) + selectedTags.length + Number(includeClosed);

  const resetFilters = () => {
    hasSelectedPrefecture.current = false;
    setQuery("");
    setSelectedPrefecture("");
    setSelectedTags([]);
    setIncludeClosed(false);
    setSelectedPubId(null);
  };

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  const requestCurrentLocation = () => {
    const geolocation = navigator.geolocation;

    if (!geolocation) {
      setGeolocationStatus("unsupported");
      return;
    }

    setGeolocationStatus("requesting");

    // OSの許可ダイアログは、利用目的を読んだ後の明示操作でのみ開きます。
    geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!isMounted.current) {
          return;
        }

        const location = { latitude: coords.latitude, longitude: coords.longitude };
        const nearestPrefecture = getNearestAvailablePrefecture(pubs, location);
        setCurrentLocation(location);
        setCurrentPrefecture(nearestPrefecture);
        setGeolocationStatus(nearestPrefecture ? "success" : "no-pubs");

        // 利用者が既に都道府県を選んだ場合は、遅れて返った位置情報で上書きしません。
        if (!hasSelectedPrefecture.current) {
          setSelectedPrefecture(nearestPrefecture);
        }
      },
      (error) => {
        if (!isMounted.current) {
          return;
        }

        setGeolocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "error");
      },
      GEOLOCATION_OPTIONS,
    );
  };

  const currentLocationAction =
    geolocationStatus === "requesting"
      ? t.explorer.currentLocationRequesting
      : geolocationStatus === "success" || geolocationStatus === "no-pubs"
        ? t.explorer.currentLocationRefresh
        : geolocationStatus === "denied" || geolocationStatus === "error"
          ? t.explorer.currentLocationRetry
          : t.explorer.currentLocationAction;
  const currentLocationStatusMessage =
    geolocationStatus === "success"
      ? t.explorer.currentLocationSuccess
      : geolocationStatus === "no-pubs"
        ? t.explorer.currentLocationNoPubs
        : geolocationStatus === "denied"
          ? t.explorer.currentLocationDenied
          : geolocationStatus === "error"
            ? t.explorer.currentLocationError
            : geolocationStatus === "unsupported"
              ? t.explorer.currentLocationUnsupported
              : null;

  return (
    <div className="pub-explorer">
      <section className="search-panel" aria-labelledby="pub-search-heading">
        <div className="search-panel-heading">
          <div>
            <p className="section-kicker">{t.explorer.kicker}</p>
            <h2 id="pub-search-heading">{t.explorer.heading}</h2>
          </div>
        </div>
        <div className="primary-search-controls">
          <div className="search-control">
            <label className="search-label" htmlFor="pub-search">
              {t.explorer.searchLabel}
            </label>
            <div className="search-row">
              <span className="search-icon" aria-hidden="true">
                ⌕
              </span>
              <input
                id="pub-search"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedPubId(null);
                }}
                placeholder={t.explorer.searchPlaceholder}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setSelectedPubId(null);
                  }}
                >
                  {t.explorer.clear}
                </button>
              ) : null}
            </div>
          </div>
          <div className="current-location-control">
            <p>{t.explorer.currentLocationDescription}</p>
            {geolocationStatus === "unsupported" ? null : (
              <button
                type="button"
                className="current-location-action"
                onClick={requestCurrentLocation}
                disabled={geolocationStatus === "requesting"}
              >
                {currentLocationAction}
              </button>
            )}
            {currentLocationStatusMessage ? (
              <p
                className={"current-location-status current-location-status-" + geolocationStatus}
                role={geolocationStatus === "denied" || geolocationStatus === "error" ? "alert" : "status"}
              >
                {currentLocationStatusMessage}
              </p>
            ) : null}
          </div>
        </div>
        <div className="search-panel-footer">
          <p className="search-result-count" aria-live="polite">
            {formatMessage(t.explorer.resultCount, { count: filteredPubs.length })}
          </p>
          <button
            type="button"
            className={"filter-toggle" + (detailedFilterCount ? " filter-toggle-active" : "")}
            aria-expanded={isFiltersExpanded}
            aria-controls="pub-filter-options"
            onClick={() => setIsFiltersExpanded((current) => !current)}
          >
            <span>{isFiltersExpanded ? t.explorer.hideFilters : t.explorer.showFilters}</span>
            {detailedFilterCount ? (
              <span
                className="filter-toggle-count"
                aria-label={formatMessage(t.explorer.activeFilterCount, { count: detailedFilterCount })}
              >
                {detailedFilterCount}
              </span>
            ) : null}
            <span className="filter-toggle-chevron" aria-hidden="true">
              {isFiltersExpanded ? "⌃" : "⌄"}
            </span>
          </button>
        </div>
        {isFiltersExpanded ? (
          <div className="filter-details" id="pub-filter-options">
            <div className="filter-row">
              <label htmlFor="pub-prefecture-filter">
                {t.explorer.prefecture}
                <select
                  id="pub-prefecture-filter"
                  value={selectedPrefecture}
                  onChange={(event) => {
                    hasSelectedPrefecture.current = true;
                    setSelectedPrefecture(event.target.value);
                    setSelectedPubId(null);
                  }}
                >
                  <option value="">{t.explorer.allPrefectures}</option>
                  {availablePrefectures.map((prefecture) => (
                    <option value={prefecture} key={prefecture}>
                      {prefecture}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="tag-filter">
                <legend>{t.explorer.tags}</legend>
                <div className="tag-filter-options">
                  {availableTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);

                    return (
                      <button
                        type="button"
                        key={tag}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedTags((current) =>
                            isSelected ? current.filter((item) => item !== tag) : [...current, tag],
                          );
                          setSelectedPubId(null);
                        }}
                      >
                        {pubs.find((pub) => pub.tags.includes(tag))?.tagDisplayNames?.[tag] ?? getTagLabel(locale, tag)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <label className="closed-filter">
                <input
                  type="checkbox"
                  checked={includeClosed}
                  aria-label={t.explorer.includeClosed}
                  onChange={(event) => {
                    setIncludeClosed(event.target.checked);
                    setSelectedPubId(null);
                  }}
                />
                <span>{t.explorer.includeClosed}</span>
              </label>
              {hasActiveFilters ? (
                <button type="button" className="filter-reset" onClick={resetFilters}>
                  {t.explorer.resetFilters}
                </button>
              ) : null}
            </div>
            <p className="search-help">{t.explorer.help}</p>
          </div>
        ) : null}
      </section>

      <section className="map-layout" aria-label={t.explorer.mapAndListLabel}>
        <PubMap
          pubs={filteredPubs}
          focusPubs={mapFocusPubs}
          currentLocation={currentLocation}
          selectedPubId={selectedPubId}
          onSelectPub={setSelectedPubId}
          locale={locale}
        />
        <PubList pubs={filteredPubs} selectedPubId={selectedPubId} onSelectPub={setSelectedPubId} locale={locale} />
      </section>
    </div>
  );
}
