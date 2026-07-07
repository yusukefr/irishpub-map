"use client";

import { useMemo, useState } from "react";
import type { Pub } from "@irishpub-map/shared/pub";
import { filterPubsByQuery } from "../lib/pub-search";
import { PubList } from "./pub-list";
import { PubMap } from "./pub-map";

type PubExplorerProps = {
  pubs: Pub[];
};

export function PubExplorer({ pubs }: PubExplorerProps) {
  const [query, setQuery] = useState("");
  const filteredPubs = useMemo(() => filterPubsByQuery(pubs, query), [pubs, query]);

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
        <p>{filteredPubs.length}件のPubが見つかりました</p>
      </section>

      <section className="map-layout" aria-label="Irish Pub map and list">
        <PubMap pubs={filteredPubs} />
        <PubList pubs={filteredPubs} />
      </section>
    </>
  );
}
