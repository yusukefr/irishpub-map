"use client";

import { useRef } from "react";
import type { Pub } from "@irishpub-map/shared/pub";
import { PubFilterPanel } from "./pub-filter-panel";
import { PubResultsPanel } from "./pub-results-panel";
import { CurrentLocationControl, type GeolocationStatus } from "./current-location-control";
import type { Locale } from "../lib/i18n";

type MapSearchControlsProps = {
  query: string;
  searchLabel: string;
  searchPlaceholder: string;
  clearLabel: string;
  resultCount: string;
  showFiltersLabel: string;
  hideFiltersLabel: string;
  activeFilterCountLabel: string | null;
  filterPanelLabel: string;
  closeFiltersLabel: string;
  prefectureLabel: string;
  allPrefecturesLabel: string;
  tagsLabel: string;
  includeClosedLabel: string;
  resetFiltersLabel: string;
  help: string;
  currentLocationStatus: GeolocationStatus;
  currentLocationActionLabel: string;
  currentLocationPrivacyDescription: string;
  currentLocationStatusMessage: string | null;
  availablePrefectures: string[];
  availableTags: Array<{ id: string; label: string }>;
  selectedPrefecture: string;
  selectedTags: string[];
  includeClosed: boolean;
  hasActiveFilters: boolean;
  isFiltersExpanded: boolean;
  detailedFilterCount: number;
  isResultsOpen: boolean;
  resultsView: "list" | "detail";
  resultsPubs: Pub[];
  selectedPubId: string | null;
  resultsPanelLabel: string;
  closeResultsLabel: string;
  backToResultsLabel: string;
  emptyResultsLabel: string;
  emptyResultsDescription: string;
  resultsLocale: Locale;
  onQueryChange: (query: string) => void;
  onRequestCurrentLocation: () => void;
  onToggleFilters: () => void;
  onCloseFilters: () => void;
  onPrefectureChange: (prefecture: string) => void;
  onTagToggle: (tag: string) => void;
  onIncludeClosedChange: (includeClosed: boolean) => void;
  onResetFilters: () => void;
  onToggleResults: () => void;
  onCloseResults: () => void;
  onSelectResult: (pubId: string) => void;
  onShowResultDetails: (pubId: string) => void;
  onBackToResults: () => void;
};

/**
 * 検索、絞り込み、現在地、結果件数をMap上の操作レイヤーへまとめます。
 * @param {MapSearchControlsProps} props - 探索状態と表示・操作コールバック。
 * @returns {JSX.Element} Map操作を妨げない探索コントロール。
 */
export function MapSearchControls({
  query,
  searchLabel,
  searchPlaceholder,
  clearLabel,
  resultCount,
  showFiltersLabel,
  hideFiltersLabel,
  activeFilterCountLabel,
  filterPanelLabel,
  closeFiltersLabel,
  prefectureLabel,
  allPrefecturesLabel,
  tagsLabel,
  includeClosedLabel,
  resetFiltersLabel,
  help,
  currentLocationStatus,
  currentLocationActionLabel,
  currentLocationPrivacyDescription,
  currentLocationStatusMessage,
  availablePrefectures,
  availableTags,
  selectedPrefecture,
  selectedTags,
  includeClosed,
  hasActiveFilters,
  isFiltersExpanded,
  detailedFilterCount,
  isResultsOpen,
  resultsView,
  resultsPubs,
  selectedPubId,
  resultsPanelLabel,
  closeResultsLabel,
  backToResultsLabel,
  emptyResultsLabel,
  emptyResultsDescription,
  resultsLocale,
  onQueryChange,
  onRequestCurrentLocation,
  onToggleFilters,
  onCloseFilters,
  onPrefectureChange,
  onTagToggle,
  onIncludeClosedChange,
  onResetFilters,
  onToggleResults,
  onCloseResults,
  onSelectResult,
  onShowResultDetails,
  onBackToResults,
}: MapSearchControlsProps) {
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);
  const resultsTriggerRef = useRef<HTMLButtonElement | null>(null);

  const closeFilters = () => {
    onCloseFilters();
    filterTriggerRef.current?.focus();
  };

  const closeResults = () => {
    onCloseResults();
    resultsTriggerRef.current?.focus();
  };

  return (
    <div className="map-search-controls" aria-label={filterPanelLabel}>
      <div className="map-search-controls-toolbar">
        <div className="map-search-field">
          <label className="visually-hidden" htmlFor="pub-search">
            {searchLabel}
          </label>
          <div className="search-row">
            <span className="search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              id="pub-search"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={searchPlaceholder}
            />
            {query ? (
              <button type="button" onClick={() => onQueryChange("")}>
                {clearLabel}
              </button>
            ) : null}
          </div>
        </div>
        <button
          ref={filterTriggerRef}
          type="button"
          className={"filter-toggle" + (detailedFilterCount ? " filter-toggle-active" : "")}
          aria-expanded={isFiltersExpanded}
          aria-controls="pub-filter-options"
          onClick={onToggleFilters}
        >
          <span>{isFiltersExpanded ? hideFiltersLabel : showFiltersLabel}</span>
          {activeFilterCountLabel ? (
            <span className="filter-toggle-count" aria-label={activeFilterCountLabel}>
              {detailedFilterCount}
            </span>
          ) : null}
          <span className="filter-toggle-chevron" aria-hidden="true">
            {isFiltersExpanded ? "⌃" : "⌄"}
          </span>
        </button>
        <CurrentLocationControl
          status={currentLocationStatus}
          actionLabel={currentLocationActionLabel}
          privacyDescription={currentLocationPrivacyDescription}
          statusMessage={currentLocationStatusMessage}
          onRequest={onRequestCurrentLocation}
        />
      </div>
      {isFiltersExpanded ? (
        <PubFilterPanel
          availablePrefectures={availablePrefectures}
          availableTags={availableTags}
          selectedPrefecture={selectedPrefecture}
          selectedTags={selectedTags}
          includeClosed={includeClosed}
          hasActiveFilters={hasActiveFilters}
          prefectureLabel={prefectureLabel}
          allPrefecturesLabel={allPrefecturesLabel}
          tagsLabel={tagsLabel}
          includeClosedLabel={includeClosedLabel}
          resetLabel={resetFiltersLabel}
          help={help}
          closeLabel={closeFiltersLabel}
          panelLabel={filterPanelLabel}
          onClose={closeFilters}
          onPrefectureChange={onPrefectureChange}
          onTagToggle={onTagToggle}
          onIncludeClosedChange={onIncludeClosedChange}
          onReset={onResetFilters}
        />
      ) : null}
      {isResultsOpen ? (
        <PubResultsPanel
          pubs={resultsPubs}
          selectedPubId={selectedPubId}
          view={resultsView}
          locale={resultsLocale}
          closeLabel={closeResultsLabel}
          backLabel={backToResultsLabel}
          panelLabel={resultsPanelLabel}
          emptyLabel={emptyResultsLabel}
          emptyDescription={emptyResultsDescription}
          onClose={closeResults}
          onSelectPub={onSelectResult}
          onShowDetails={onShowResultDetails}
          onBackToList={onBackToResults}
        />
      ) : null}
      <button
        ref={resultsTriggerRef}
        type="button"
        className="map-result-count"
        aria-live="polite"
        aria-expanded={isResultsOpen}
        aria-controls="pub-results-panel"
        onClick={onToggleResults}
      >
        {resultCount}
      </button>
    </div>
  );
}
