"use client";

import { useEffect, useRef } from "react";
import type { Pub } from "@irishpub-map/shared/pub";
import { getTranslation, type Locale } from "../lib/i18n";
import { PubDetail } from "./pub-detail";
import { PubList } from "./pub-list";

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

  useEffect(() => {
    if (view === "detail") {
      backButtonRef.current?.focus();
    } else {
      closeButtonRef.current?.focus();
    }
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
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <aside className="pub-results-panel" id="pub-results-panel" aria-labelledby="pub-results-panel-heading">
      <header className="pub-results-panel-header">
        <div>
          {view === "detail" ? (
            <button ref={backButtonRef} type="button" className="pub-results-back" onClick={onBackToList}>
              ← {backLabel}
            </button>
          ) : null}
          <h2 id="pub-results-panel-heading">{view === "detail" && selectedPub ? selectedPub.name : panelLabel}</h2>
        </div>
        <button ref={closeButtonRef} type="button" className="pub-results-close" onClick={onClose}>
          {closeLabel}
        </button>
      </header>
      {view === "detail" && selectedPub ? (
        <div className="pub-results-scroll">
          <PubDetail pub={selectedPub} locale={locale} labels={t.list} />
        </div>
      ) : pubs.length > 0 ? (
        <div className="pub-results-scroll">
          <PubList
            pubs={pubs}
            selectedPubId={selectedPubId}
            onSelectPub={onSelectPub}
            onShowDetails={onShowDetails}
            resultRefs={resultRefs}
            locale={locale}
            hideHeader
          />
        </div>
      ) : (
        <div className="pub-results-empty" role="status">
          <h3>{emptyLabel}</h3>
          <p>{emptyDescription}</p>
        </div>
      )}
    </aside>
  );
}
