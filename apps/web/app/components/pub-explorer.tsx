"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import { PubResultsPanel } from "./pub-results-panel";
import { MapSearchControls } from "./map-search-controls";
import { type GeolocationStatus } from "./current-location-control";
import styles from "./desktop-map.module.css";
import mobile from "./mobile-map.module.css";
import { BottomSheet, type BottomSheetState } from "./ui/bottom-sheet";

type PubExplorerProps = {
  pubs: Pub[];
  locale?: Locale;
  dataLoadFailed?: boolean;
};

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 300000,
  timeout: 5000,
};

const EMPTY_FOCUS_PUBS: Pub[] = [];

// CSSのDesktop境界と揃え、リサイズの各pixelではなく境界変更だけを購読します。
const DESKTOP_QUERY = "(min-width: 981px)";
function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia?.(DESKTOP_QUERY);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}
function getDesktopSnapshot() {
  return window.matchMedia?.(DESKTOP_QUERY).matches ?? false;
}
function getServerDesktopSnapshot() {
  return false;
}

/**
 * 検索条件、地図、店舗一覧で共有する探索状態を一元管理します。
 * @param {PubExplorerProps} props - 検索対象、表示言語、店舗取得失敗の状態。
 * @returns {JSX.Element} 検索・地図・一覧を組み合わせた探索画面。
 */
export function PubExplorer({ pubs, locale = DEFAULT_LOCALE, dataLoadFailed = false }: PubExplorerProps) {
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
  const isDesktop = useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, getServerDesktopSnapshot);
  // Desktopの開閉とMobileの高さを個別に保持し、幅変更で探索状態を初期化しません。
  const [resultsOpenOverride, setIsResultsOpen] = useState<boolean | null>(null);
  const [sheetState, setSheetState] = useState<BottomSheetState>("collapsed");
  const listSheetState = useRef<BottomSheetState>("medium");
  // Desktopで両方を開いたまま幅を狭めても、MobileのOverlayは重ねません。
  const isResultsOpen = isDesktop ? (resultsOpenOverride ?? true) : sheetState !== "collapsed" && !isFiltersExpanded;
  const [resultsView, setResultsView] = useState<"list" | "detail">("list");
  const resultsTriggerRef = useRef<HTMLButtonElement | null>(null);
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

  useEffect(() => {
    if (!selectedPubId || filteredPubs.some((pub) => pub.id === selectedPubId)) {
      return;
    }

    // 描画コミット後に選択状態を解消し、Reactの同期effect更新を避けます。
    const resetId = window.setTimeout(() => {
      setSelectedPubId(null);
      setResultsView("list");
    }, 0);

    return () => window.clearTimeout(resetId);
  }, [filteredPubs, selectedPubId]);

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
    if (!isDesktop) {
      setIsFiltersExpanded(false);
      setSheetState((current) => (current === "collapsed" ? "medium" : current));
    }
    if (isDesktop && !isResultsOpen) {
      setIsResultsOpen(true);
    }
  };

  const toggleFilters = () => {
    setIsFiltersExpanded((current) => {
      if (!current && !isDesktop) {
        setSheetState("collapsed");
      }
      return !current;
    });
  };

  const toggleResults = () => {
    if (!isResultsOpen) {
      setIsFiltersExpanded(false);
      setResultsView("list");
    }
    if (!isDesktop) setSheetState(isResultsOpen ? "collapsed" : "medium");
    setIsResultsOpen(!isResultsOpen);
  };

  const closeResults = () => {
    setSheetState("collapsed");
    setIsResultsOpen(false);
    setResultsView("list");
    resultsTriggerRef.current?.focus();
  };

  const showResultDetails = (pubId: string) => {
    listSheetState.current = sheetState === "collapsed" ? "medium" : sheetState;
    if (!isDesktop) setSheetState("expanded");
    setSelectedPubId(pubId);
    setResultsView("detail");
  };

  const resultsPanel = isResultsOpen ? (
    <PubResultsPanel
      compact={isDesktop}
      focusOnOpen={resultsOpenOverride !== null}
      escapeEnabled={!isFiltersExpanded}
      resetLabel={dataLoadFailed ? t.map.retryPubs : t.explorer.resetFilters}
      onReset={() => {
        if (dataLoadFailed) {
          window.location.reload();
          return;
        }
        setQuery("");
        resetDetailedFilters();
        document.getElementById("pub-search")?.focus();
      }}
      pubs={filteredPubs}
      selectedPubId={selectedPubId}
      view={resultsView}
      locale={locale}
      closeLabel={t.list.closeResults}
      backLabel={t.list.backToResults}
      panelLabel={t.list.heading}
      emptyLabel={dataLoadFailed ? t.map.pubsLoadFailed : t.list.noResults}
      emptyDescription={dataLoadFailed ? t.map.pubsLoadFailedDescription : t.list.noResultsDescription}
      emptyIsError={dataLoadFailed}
      onClose={closeResults}
      onSelectPub={selectPub}
      onShowDetails={showResultDetails}
      onBackToList={() => {
        setResultsView("list");
        if (!isDesktop) setSheetState(listSheetState.current);
      }}
    />
  ) : null;

  return (
    <div className="pub-explorer">
      <section
        className={["map-layout", styles.layout, mobile.layout, isResultsOpen ? "map-layout-results-open" : ""]
          .filter(Boolean)
          .join(" ")}
        data-sheet-state={isFiltersExpanded ? "collapsed" : sheetState}
        aria-label={t.explorer.mapAndListLabel}
      >
        <div className={styles.explorationPanel}>
          <MapSearchControls
            query={query}
            searchLabel={t.explorer.searchLabel}
            searchPlaceholder={t.explorer.searchPlaceholder}
            clearLabel={t.explorer.clear}
            resultCount={
              dataLoadFailed
                ? t.map.pubsLoadFailed
                : formatMessage(t.explorer.resultCount, { count: filteredPubs.length })
            }
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
            isResultsOpen={isResultsOpen}
            resultsTriggerRef={resultsTriggerRef}
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
          />
          {isDesktop ? (
            resultsPanel
          ) : (
            <div className={mobile.sheetPosition}>
              <BottomSheet
                className={mobile.sheet}
                state={isFiltersExpanded ? "collapsed" : sheetState}
                onStateChange={(state) => {
                  setIsFiltersExpanded(false);
                  setSheetState(state);
                }}
                title={t.list.heading}
                resizeLabel={t.explorer.resizeSheet}
                stateLabels={t.explorer.sheetStates}
              >
                {resultsPanel}
              </BottomSheet>
            </div>
          )}
        </div>
        <div className="map-workspace">
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
