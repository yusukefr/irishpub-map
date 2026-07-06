import pubs from "../../../data/pubs.json";
import { PubMap } from "./components/pub-map";
import { PubList } from "./components/pub-list";
import { asPubs } from "@irishpub-map/shared/pub";

const pubList = asPubs(pubs);

export default function Home() {
  return (
    <main className="page-shell">
      <section className="masthead">
        <div>
          <p className="eyebrow">Irish Pub Finder</p>
          <h1>日本の Irish Pub マップ</h1>
          <p className="lead">
            地図から日本国内の Irish Pub を探せる Web アプリです。まずはサンプルデータで地図表示と店舗詳細の土台を作っています。
          </p>
        </div>
      </section>

      <section className="map-layout" aria-label="Irish Pub map and list">
        <PubMap pubs={pubList} />
        <PubList pubs={pubList} />
      </section>
    </main>
  );
}
