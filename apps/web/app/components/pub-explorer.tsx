"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Pub, PubStatus } from "@irishpub-map/shared/pub";
import { getTagLabel } from "@irishpub-map/shared/tag";
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
};

const STATUS_LABELS: Record<PubStatus, string> = {
  open: "営業中",
  temporarily_closed: "一時休業",
  closed: "閉業",
  unknown: "不明",
};

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 300000,
  timeout: 5000,
};

const EMPTY_FOCUS_PUBS: Pub[] = [];

/** 検索条件、地図、店舗一覧で共有する探索状態を一元管理します。 */
export function PubExplorer({ pubs }: PubExplorerProps) {
  const [query, setQuery] = useState("");
  const [selectedPrefecture, setSelectedPrefecture] = useState("");
  const [currentPrefecture, setCurrentPrefecture] = useState("");
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<PubStatus | "">("");
  const [selectedPubId, setSelectedPubId] = useState<string | null>(null);
  const hasSelectedPrefecture = useRef(false);
  const availablePrefectures = useMemo(() => getAvailablePrefectures(pubs), [pubs]);
  const availableTags = useMemo(() => getAvailableTags(pubs), [pubs]);
  const filteredPubs = useMemo(
    () => filterPubs(pubs, { query, prefecture: selectedPrefecture, tags: selectedTags, status: selectedStatus }),
    [pubs, query, selectedPrefecture, selectedTags, selectedStatus],
  );
  const prefecturePubs = useMemo(
    () => (selectedPrefecture ? filterPubs(pubs, { prefecture: selectedPrefecture }) : []),
    [pubs, selectedPrefecture],
  );
  const mapFocusPubs = selectedPrefecture === currentPrefecture ? EMPTY_FOCUS_PUBS : prefecturePubs;
  const hasActiveFilters = Boolean(query || selectedPrefecture || selectedTags.length || selectedStatus);

  const resetFilters = () => {
    hasSelectedPrefecture.current = false;
    setQuery("");
    setSelectedPrefecture("");
    setSelectedTags([]);
    setSelectedStatus("");
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
            <p className="section-kicker">Find a pub</p>
            <h2 id="pub-search-heading">地図と条件から探す</h2>
          </div>
          <p className="search-result-count" aria-live="polite">
            {filteredPubs.length}件のPubが見つかりました
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
            placeholder="店舗名、エリア"
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
              <option value="">すべての都道府県</option>
              {availablePrefectures.map((prefecture) => (
                <option value={prefecture} key={prefecture}>
                  {prefecture}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="tag-filter">
            <legend>タグ</legend>
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
                    {getTagLabel(tag)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label htmlFor="pub-status-filter">
            営業状況
            <select
              id="pub-status-filter"
              value={selectedStatus}
              onChange={(event) => {
                setSelectedStatus(event.target.value as PubStatus | "");
                setSelectedPubId(null);
              }}
            >
              <option value="">すべての営業状況</option>
              <option value="open">{STATUS_LABELS.open}</option>
            </select>
          </label>
          {hasActiveFilters ? (
            <button type="button" className="filter-reset" onClick={resetFilters}>
              条件をリセット
            </button>
          ) : null}
        </div>
        <p className="search-help">店舗名・エリア・タグ・営業状況を組み合わせて絞り込めます。</p>
      </section>

      <section className="map-layout" aria-label="Irish Pub map and list">
        <PubMap
          pubs={filteredPubs}
          focusPubs={mapFocusPubs}
          currentLocation={currentLocation}
          selectedPubId={selectedPubId}
          onSelectPub={setSelectedPubId}
        />
        <PubList pubs={filteredPubs} selectedPubId={selectedPubId} onSelectPub={setSelectedPubId} />
      </section>
    </div>
  );
}
