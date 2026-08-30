"use client";

import { useRef, type RefObject } from "react";
import { PubFilterPanel } from "./pub-filter-panel";
import { CurrentLocationControl, type GeolocationStatus } from "./current-location-control";

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
  resultsTriggerRef: RefObject<HTMLButtonElement | null>;
  onQueryChange: (query: string) => void;
  onRequestCurrentLocation: () => void;
  onToggleFilters: () => void;
  onCloseFilters: () => void;
  onPrefectureChange: (prefecture: string) => void;
  onTagToggle: (tag: string) => void;
  onIncludeClosedChange: (includeClosed: boolean) => void;
  onResetFilters: () => void;
  onToggleResults: () => void;
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
  resultsTriggerRef,
  onQueryChange,
  onRequestCurrentLocation,
  onToggleFilters,
  onCloseFilters,
  onPrefectureChange,
  onTagToggle,
  onIncludeClosedChange,
  onResetFilters,
  onToggleResults,
}: MapSearchControlsProps) {
  const filterTriggerRef = useRef<HTMLButtonElement | null>(null);

  const closeFilters = () => {
    onCloseFilters();
    filterTriggerRef.current?.focus();
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
