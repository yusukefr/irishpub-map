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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [selectedPubId, setSelectedPubId] = useState<string | null>(null);
  const hasSelectedPrefecture = useRef(false);
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

  const resetFilters = () => {
    hasSelectedPrefecture.current = false;
    setQuery("");
    setSelectedPrefecture("");
    setSelectedTags([]);
    setIncludeClosed(false);
    setSelectedPubId(null);
  };

  useEffect(() => {
    const geolocation = navigator.geolocation;

    if (!geolocation) {
      return;
    }

    let isMounted = true;

    geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!isMounted) {
          return;
        }

        const location = { latitude: coords.latitude, longitude: coords.longitude };
        const nearestPrefecture = getNearestAvailablePrefecture(pubs, location);
        setCurrentLocation(location);
        setCurrentPrefecture(nearestPrefecture);

        // 利用者が既に都道府県を選んだ場合は、遅れて返った位置情報で上書きしません。
        if (!hasSelectedPrefecture.current) {
          setSelectedPrefecture(nearestPrefecture);
        }
      },
      () => undefined,
      GEOLOCATION_OPTIONS,
    );

    return () => {
      isMounted = false;
    };
  }, [pubs]);

  return (
    <div className="pub-explorer">
      <section className="search-panel" aria-labelledby="pub-search-heading">
        <div className="search-panel-heading">
          <div>
            <p className="section-kicker">{t.explorer.kicker}</p>
            <h2 id="pub-search-heading">{t.explorer.heading}</h2>
          </div>
          <p className="search-result-count" aria-live="polite">
            {formatMessage(t.explorer.resultCount, { count: filteredPubs.length })}
          </p>
        </div>
        <label className="search-label" htmlFor="pub-search">
          店舗を検索
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
              クリア
            </button>
          ) : null}
        </div>
        <div className="filter-row">
          <label htmlFor="pub-prefecture-filter">
            都道府県
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
                    {getTagLabel(locale, tag)}
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
              条件をリセット
            </button>
          ) : null}
        </div>
        <p className="search-help">{t.explorer.help}</p>
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
