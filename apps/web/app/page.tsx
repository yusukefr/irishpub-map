import { headers } from "next/headers";
import { AppHeader } from "./components/app-header";
import { AppVersionFooter } from "./components/app-version-footer";
import { PubExplorer } from "./components/pub-explorer";
import { asPubs } from "@irishpub-map/shared/pub";
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

  return (
    <main className="map-app-shell">
      <AppHeader locale={locale} />
      <div className="map-app-main">
        <PubExplorer pubs={pubList} locale={locale} />
      </div>
      <AppVersionFooter locale={locale} variant="compact" />
    </main>
  );
}
