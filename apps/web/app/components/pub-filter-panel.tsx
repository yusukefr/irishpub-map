"use client";

import { useEffect, useRef } from "react";
import { FilterChip, FilterChipGroup } from "./ui/filter-chip";
import { Button } from "./ui/button";

type TagOption = {
  id: string;
  label: string;
};

type PubFilterPanelProps = {
  availablePrefectures: string[];
  availableTags: TagOption[];
  selectedPrefecture: string;
  selectedTags: string[];
  includeClosed: boolean;
  hasActiveFilters: boolean;
  prefectureLabel: string;
  allPrefecturesLabel: string;
  tagsLabel: string;
  includeClosedLabel: string;
  resetLabel: string;
  help: string;
  closeLabel: string;
  panelLabel: string;
  onClose: () => void;
  onPrefectureChange: (prefecture: string) => void;
  onTagToggle: (tag: string) => void;
  onIncludeClosedChange: (includeClosed: boolean) => void;
  onReset: () => void;
};

/**
 * 非モーダルの絞り込みパネルを表示し、Escapeで親へ閉じる操作を通知します。
 * @param {PubFilterPanelProps} props - 絞り込み候補、選択状態、操作コールバック。
 * @returns {JSX.Element} Map上の絞り込みパネル。
 */
export function PubFilterPanel({
  availablePrefectures,
  availableTags,
  selectedPrefecture,
  selectedTags,
  includeClosed,
  hasActiveFilters,
  prefectureLabel,
  allPrefecturesLabel,
  tagsLabel,
  includeClosedLabel,
  resetLabel,
  help,
  closeLabel,
  panelLabel,
  onClose,
  onPrefectureChange,
  onTagToggle,
  onIncludeClosedChange,
  onReset,
}: PubFilterPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <section
      className="filter-details filter-panel"
      id="pub-filter-options"
      aria-labelledby="pub-filter-options-heading"
    >
      <div className="filter-panel-header">
        <h2 id="pub-filter-options-heading" className="visually-hidden">
          {panelLabel}
        </h2>
        <Button ref={closeButtonRef} variant="ghost" className="filter-panel-close" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
      <div className="filter-row">
        <label htmlFor="pub-prefecture-filter">
          {prefectureLabel}
          <select
            id="pub-prefecture-filter"
            value={selectedPrefecture}
            onChange={(event) => onPrefectureChange(event.target.value)}
          >
            <option value="">{allPrefecturesLabel}</option>
            {availablePrefectures.map((prefecture) => (
              <option value={prefecture} key={prefecture}>
                {prefecture}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="tag-filter">
          <legend>{tagsLabel}</legend>
          <FilterChipGroup label={tagsLabel}>
            {availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);

              return (
                <FilterChip key={tag.id} selected={isSelected} onClick={() => onTagToggle(tag.id)}>
                  {tag.label}
                </FilterChip>
              );
            })}
          </FilterChipGroup>
        </fieldset>
        <label className="closed-filter">
          <input
            type="checkbox"
            checked={includeClosed}
            aria-label={includeClosedLabel}
            onChange={(event) => onIncludeClosedChange(event.target.checked)}
          />
          <span>{includeClosedLabel}</span>
        </label>
        {hasActiveFilters ? (
          <Button variant="secondary" className="filter-reset" onClick={onReset}>
            {resetLabel}
          </Button>
        ) : null}
      </div>
      <p className="search-help">{help}</p>
    </section>
  );
}
