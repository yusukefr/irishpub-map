import pubs from "../../../data/pubs.json";
import { PubExplorer } from "./components/pub-explorer";
import { asPubs } from "@irishpub-map/shared/pub";

const pubList = asPubs(pubs);

export default function Home() {
  return (
    <main className="page-shell">
      <section className="masthead">
        <div>
          <p className="eyebrow">Irish Pub Finder</p>
          <h1>Irish Pub Map in Japan</h1>
          <p className="lead">
            地図から日本国内の Irish Pub を探せる Web アプリです。まずはサンプルデータで地図表示と店舗詳細の土台を作っています。
          </p>
        </div>
      </section>

      <PubExplorer pubs={pubList} />
    </main>
  );
}
