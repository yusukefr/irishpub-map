"use client";

import { useEffect, useRef } from "react";
import type { Pub } from "@irishpub-map/shared/pub";
import { getTranslation, type Locale } from "../lib/i18n";
import { PubDetail } from "./pub-detail";
import { PubList } from "./pub-list";
import { Button } from "./ui/button";

type PubResultsPanelProps = {
  pubs: Pub[];
  selectedPubId: string | null;
  view: "list" | "detail";
  locale: Locale;
  closeLabel: string;
  backLabel: string;
  panelLabel: string;
  emptyLabel: string;
  emptyDescription: string;
  emptyIsError?: boolean;
  /** 自動初期表示ではfalse。マウント時だけ適用し、選択変更ではfocusを奪いません。 */
  focusOnOpen?: boolean;
  compact?: boolean;
  escapeEnabled?: boolean;
  resetLabel?: string;
  onReset?: () => void;
  onClose: () => void;
  onSelectPub: (pubId: string) => void;
  onShowDetails: (pubId: string) => void;
  onBackToList: () => void;
};

/**
 * 絞り込み結果の一覧と選択店舗の詳細を同じPanel内で切り替えます。
 * @param {PubResultsPanelProps} props - 結果、選択状態、表示View、操作コールバック。
 * @returns {JSX.Element} Map上のResults Panel。
 */
export function PubResultsPanel({
  pubs,
  selectedPubId,
  view,
  locale,
  closeLabel,
  backLabel,
  panelLabel,
  emptyLabel,
  emptyDescription,
  emptyIsError = false,
  focusOnOpen = true,
  compact = false,
  escapeEnabled = true,
  resetLabel,
  onReset,
  onClose,
  onSelectPub,
  onShowDetails,
  onBackToList,
}: PubResultsPanelProps) {
  const t = getTranslation(locale);
  const resultRefs = useRef(new Map<string, HTMLElement>());
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectedPub = pubs.find((pub) => pub.id === selectedPubId) ?? null;
  const previousView = useRef(view);
  const initialFocusOnOpen = useRef(focusOnOpen);

  useEffect(() => {
    if (view === "detail") {
      backButtonRef.current?.focus();
    } else if (initialFocusOnOpen.current || previousView.current === "detail") {
      closeButtonRef.current?.focus();
    }
    previousView.current = view;
  }, [view]);

  useEffect(() => {
    if (view !== "list" || !selectedPubId) {
      return;
    }

    const selectedResult = resultRefs.current.get(selectedPubId);
    selectedResult?.scrollIntoView?.({ block: "nearest" });
  }, [selectedPubId, view, pubs]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && escapeEnabled) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, escapeEnabled]);

  return (
    <aside className="pub-results-panel" id="pub-results-panel" aria-labelledby="pub-results-panel-heading">
      <header className="pub-results-panel-header">
        <div>
          {view === "detail" ? (
            <Button ref={backButtonRef} variant="ghost" className="pub-results-back" onClick={onBackToList}>
              ← {backLabel}
            </Button>
          ) : null}
          <h2 id="pub-results-panel-heading">{view === "detail" && selectedPub ? selectedPub.name : panelLabel}</h2>
        </div>
        <Button ref={closeButtonRef} variant="ghost" className="pub-results-close" onClick={onClose}>
          {closeLabel}
        </Button>
      </header>
      {view === "detail" && selectedPub ? (
        <div className="pub-results-scroll">
          <PubDetail pub={selectedPub} locale={locale} labels={t.list} />
        </div>
      ) : pubs.length > 0 ? (
        <div className="pub-results-scroll">
          <PubList
            pubs={pubs}
            density={compact ? "compact" : "comfortable"}
            selectedPubId={selectedPubId}
            onSelectPub={onSelectPub}
            onShowDetails={onShowDetails}
            resultRefs={resultRefs}
            locale={locale}
            hideHeader
          />
        </div>
      ) : (
        <div className="pub-results-empty" role={emptyIsError ? "alert" : "status"}>
          <h3>{emptyLabel}</h3>
          <p>{emptyDescription}</p>
          {onReset ? (
            <Button variant="secondary" onClick={onReset}>
              {resetLabel}
            </Button>
          ) : null}
        </div>
      )}
    </aside>
  );
}
