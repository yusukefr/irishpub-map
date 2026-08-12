import { headers } from "next/headers";
import { AppVersionFooter } from "./components/app-version-footer";
import { PubExplorer } from "./components/pub-explorer";
import { getValidatedPubs } from "./lib/pub-data";
import { asPubs } from "@irishpub-map/shared/pub";

const API_KEY_HEADER = "x-api-key";
const VERCEL_PROTECTION_BYPASS_HEADER = "x-vercel-protection-bypass";

function createPubsApiHeaders() {
  const apiHeaders: Record<string, string> = {};

  if (process.env.IRISHPUB_MAP_API_KEY) {
    apiHeaders[API_KEY_HEADER] = process.env.IRISHPUB_MAP_API_KEY;
  }

  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    apiHeaders[VERCEL_PROTECTION_BYPASS_HEADER] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }

  return apiHeaders;
}

function isVercelSsoRedirect(response: Response) {
  return (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get("location")?.startsWith("https://vercel.com/sso-api")
  );
}

async function getPubs() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = process.env.VERCEL ? "https" : "http";
  const response = await fetch(`${protocol}://${host}/api/pubs`, {
    headers: createPubsApiHeaders(),
    redirect: "manual",
    cache: "no-store"
  });

  if (response.ok) {
    const data = (await response.json()) as { pubs: unknown };

    return asPubs(data.pubs);
  }

  if (process.env.VERCEL && isVercelSsoRedirect(response)) {
    return getValidatedPubs();
  }

  throw new Error("Failed to fetch pubs.");
}

export default async function Home() {
  const pubList = await getPubs();

  return (
    <main className="page-shell">
      <section className="masthead">
        <div className="masthead-copy">
          <p className="eyebrow">Irish Pub Finder / Japan</p>
          <h1>
            Irish Pub Map
            <span>in Japan</span>
          </h1>
          <p className="lead">
            現在地や都道府県、好きな過ごし方から。今日の一杯に合う Irish Pub を、地図から探せます。
          </p>
          <a className="masthead-link" href="#pub-search">
            パブを探す
            <span aria-hidden="true">↓</span>
          </a>
        </div>
        <dl className="masthead-stats" aria-label="掲載情報">
          <div>
            <dt>掲載店舗</dt>
            <dd>
              {pubList.length}
              <span> pubs</span>
            </dd>
          </div>
          <div>
            <dt>探し方</dt>
            <dd>地図・条件</dd>
          </div>
        </dl>
      </section>

      <PubExplorer pubs={pubList} />

      <AppVersionFooter />
    </main>
  );
}
