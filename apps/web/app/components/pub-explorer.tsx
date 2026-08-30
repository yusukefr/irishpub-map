"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Pub } from "@irishpub-map/shared/pub";
import { DEFAULT_LOCALE, formatMessage, getTagLabel, getTranslation, type Locale } from "../lib/i18n";
import {
  filterPubs,
  getAvailablePrefectures,
  getAvailableTags,
  getNearestAvailablePrefecture,
  type Coordinates,
} from "../lib/pub-search";
import { PubMap } from "./pub-map";
import { MapSearchControls } from "./map-search-controls";
import { type GeolocationStatus } from "./current-location-control";

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
export function PubExplorer({ pubs, locale = DEFAULT_LOCALE }: PubExplorerProps) {
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
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsView, setResultsView] = useState<"list" | "detail">("list");
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
  const hasActiveFilters = Boolean(selectedPrefecture || selectedTags.length || includeClosed);
  const detailedFilterCount = Number(Boolean(selectedPrefecture)) + selectedTags.length + Number(includeClosed);

  const clearSelectedPub = () => {
    setSelectedPubId(null);
    setResultsView("list");
  };

  const resetDetailedFilters = () => {
    hasSelectedPrefecture.current = false;
    setSelectedPrefecture("");
    setSelectedTags([]);
    setIncludeClosed(false);
    clearSelectedPub();
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

  const selectPub = (pubId: string) => {
    setSelectedPubId(pubId);
  };

  const toggleFilters = () => {
    setIsFiltersExpanded((current) => {
      if (!current) {
        setIsResultsOpen(false);
      }
      return !current;
    });
  };

  const toggleResults = () => {
    setIsResultsOpen((current) => {
      if (!current) {
        setIsFiltersExpanded(false);
        setResultsView("list");
      }
      return !current;
    });
  };

  const closeResults = () => {
    setIsResultsOpen(false);
    setResultsView("list");
  };

  const showResultDetails = (pubId: string) => {
    setSelectedPubId(pubId);
    setResultsView("detail");
  };

  return (
    <div className="pub-explorer">
      <section className="map-layout" aria-label={t.explorer.mapAndListLabel}>
        <div className="map-workspace">
          <MapSearchControls
            query={query}
            searchLabel={t.explorer.searchLabel}
            searchPlaceholder={t.explorer.searchPlaceholder}
            clearLabel={t.explorer.clear}
            resultCount={formatMessage(t.explorer.resultCount, { count: filteredPubs.length })}
            showFiltersLabel={t.explorer.showFilters}
            hideFiltersLabel={t.explorer.hideFilters}
            activeFilterCountLabel={
              detailedFilterCount ? formatMessage(t.explorer.activeFilterCount, { count: detailedFilterCount }) : null
            }
            filterPanelLabel={t.explorer.heading}
            closeFiltersLabel={t.explorer.closeFilters}
            prefectureLabel={t.explorer.prefecture}
            allPrefecturesLabel={t.explorer.allPrefectures}
            tagsLabel={t.explorer.tags}
            includeClosedLabel={t.explorer.includeClosed}
            resetFiltersLabel={t.explorer.resetFilters}
            help={t.explorer.help}
            currentLocationStatus={geolocationStatus}
            currentLocationActionLabel={currentLocationAction}
            currentLocationPrivacyDescription={t.explorer.currentLocationDescription}
            currentLocationStatusMessage={currentLocationStatusMessage}
            availablePrefectures={availablePrefectures}
            availableTags={availableTags.map((tag) => ({
              id: tag,
              label: pubs.find((pub) => pub.tags.includes(tag))?.tagDisplayNames?.[tag] ?? getTagLabel(locale, tag),
            }))}
            selectedPrefecture={selectedPrefecture}
            selectedTags={selectedTags}
            includeClosed={includeClosed}
            hasActiveFilters={hasActiveFilters}
            isFiltersExpanded={isFiltersExpanded}
            detailedFilterCount={detailedFilterCount}
            selectedPubId={selectedPubId}
            isResultsOpen={isResultsOpen}
            resultsView={resultsView}
            resultsPubs={filteredPubs}
            resultsPanelLabel={t.list.heading}
            closeResultsLabel={t.list.closeResults}
            backToResultsLabel={t.list.backToResults}
            emptyResultsLabel={t.list.noResults}
            emptyResultsDescription={t.list.noResultsDescription}
            resultsLocale={locale}
            onQueryChange={(value) => {
              setQuery(value);
              clearSelectedPub();
            }}
            onRequestCurrentLocation={requestCurrentLocation}
            onToggleFilters={toggleFilters}
            onCloseFilters={() => setIsFiltersExpanded(false)}
            onPrefectureChange={(prefecture) => {
              hasSelectedPrefecture.current = true;
              setSelectedPrefecture(prefecture);
              clearSelectedPub();
            }}
            onTagToggle={(tag) => {
              setSelectedTags((current) =>
                current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
              );
              clearSelectedPub();
            }}
            onIncludeClosedChange={(value) => {
              setIncludeClosed(value);
              clearSelectedPub();
            }}
            onResetFilters={resetDetailedFilters}
            onToggleResults={toggleResults}
            onCloseResults={closeResults}
            onSelectResult={selectPub}
            onShowResultDetails={showResultDetails}
            onBackToResults={() => setResultsView("list")}
          />
          <PubMap
            pubs={filteredPubs}
            focusPubs={mapFocusPubs}
            currentLocation={currentLocation}
            selectedPubId={selectedPubId}
            onSelectPub={selectPub}
            locale={locale}
          />
        </div>
      </section>
    </div>
  );
}
