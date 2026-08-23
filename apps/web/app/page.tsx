import { headers } from "next/headers";
import { AppVersionFooter } from "./components/app-version-footer";
import { PubExplorer } from "./components/pub-explorer";
import { asPubs } from "@irishpub-map/shared/pub";
import { LanguageSwitcher } from "./components/language-switcher";
import { getTranslation } from "./lib/i18n";
import { getRequestLocale } from "./lib/i18n/server";

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

/** 同一オリジンの公開APIから店舗を取得し、レスポンスを共有型で検証します。 */
async function getPubs(locale: string) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = process.env.VERCEL ? "https" : "http";
  const response = await fetch(`${protocol}://${host}/api/pubs?locale=${encodeURIComponent(locale)}`, {
    headers: createPubsApiHeaders(),
    redirect: "manual",
    cache: "no-store",
  });

  if (response.ok) {
    const data = (await response.json()) as { pubs: unknown };

    return asPubs(data.pubs);
  }

  // Preview ProtectionのSSOへ転送された場合は、静的データを複製せず空の一覧を表示します。
  if (process.env.VERCEL && isVercelSsoRedirect(response)) {
    return [];
  }

  throw new Error("Failed to fetch pubs.");
}

/**
 * 公開トップページをサーバー描画し、取得済み店舗を探索UIへ渡します。
 * @returns {Promise<JSX.Element>} 店舗探索画面。
 */
export default async function Home() {
  const locale = await getRequestLocale();
  const pubList = await getPubs(locale);
  const t = getTranslation(locale);

  return (
    <main className="page-shell">
      <section className="masthead">
        <LanguageSwitcher locale={locale} />
        <div className="masthead-copy">
          <p className="eyebrow">{t.home.eyebrow}</p>
          <h1>
            Irish Pub Map
            <span>in Japan</span>
          </h1>
          <p className="lead">{t.home.lead}</p>
        </div>
        <dl className="masthead-stats" aria-label={t.home.listedInformation}>
          <div>
            <dt>{t.home.listedPubs}</dt>
            <dd>
              {pubList.length}
              <span> pubs</span>
            </dd>
          </div>
        </dl>
      </section>

      <PubExplorer pubs={pubList} locale={locale} />

      <AppVersionFooter locale={locale} />
    </main>
  );
}
