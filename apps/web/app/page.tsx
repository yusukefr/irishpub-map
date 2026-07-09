import { headers } from "next/headers";
import { PubExplorer } from "./components/pub-explorer";
import { asPubs } from "@irishpub-map/shared/pub";

async function getPubs() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = process.env.VERCEL ? "https" : "http";
  const response = await fetch(`${protocol}://${host}/api/pubs`, {
    headers: process.env.IRISHPUB_MAP_API_KEY ? { "x-api-key": process.env.IRISHPUB_MAP_API_KEY } : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch pubs.");
  }

  const data = (await response.json()) as { pubs: unknown };

  return asPubs(data.pubs);
}

export default async function Home() {
  const pubList = await getPubs();

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
