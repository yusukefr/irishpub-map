"use client";

import { useMemo, useState } from "react";
import type { Pub, PubStatus } from "@irishpub-map/shared/pub";
import { filterPubs, getAvailableStatuses, getAvailableTags } from "../lib/pub-search";
import { PubList } from "./pub-list";
import { PubMap } from "./pub-map";

type PubExplorerProps = {
  pubs: Pub[];
};

const STATUS_LABELS: Record<PubStatus, string> = {
  open: "営業中",
  temporarily_closed: "一時休業",
  closed: "閉業",
  unknown: "不明"
};

export function PubExplorer({ pubs }: PubExplorerProps) {
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<PubStatus | "">("");
  const availableTags = useMemo(() => getAvailableTags(pubs), [pubs]);
  const availableStatuses = useMemo(() => getAvailableStatuses(pubs), [pubs]);
  const filteredPubs = useMemo(
    () => filterPubs(pubs, { query, tag: selectedTag, status: selectedStatus }),
    [pubs, query, selectedTag, selectedStatus]
  );

  return (
    <>
      <section className="search-panel" aria-label="Irish Pub search">
        <label htmlFor="pub-search">店舗を検索</label>
        <div className="search-row">
          <input
            id="pub-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="店舗名、都道府県、エリア"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")}>
              クリア
            </button>
          ) : null}
        </div>
        <div className="filter-row">
          <label htmlFor="pub-tag-filter">
            タグ
            <select id="pub-tag-filter" value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
              <option value="">すべてのタグ</option>
              {availableTags.map((tag) => (
                <option value={tag} key={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="pub-status-filter">
            営業状況
            <select
              id="pub-status-filter"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as PubStatus | "")}
            >
              <option value="">すべての営業状況</option>
              {availableStatuses.map((status) => (
                <option value={status} key={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p>{filteredPubs.length}件のPubが見つかりました</p>
      </section>

      <section className="map-layout" aria-label="Irish Pub map and list">
        <PubMap pubs={filteredPubs} />
        <PubList pubs={filteredPubs} />
      </section>
    </>
  );
}
