import { getPublishedPubs } from "../../lib/pub-repository";
import { DEFAULT_LOCALE } from "../../lib/i18n";
import { parsePublicPubsQuery } from "../../lib/public-pubs-query";

const PUBLIC_CACHE_CONTROL = "public, max-age=0, s-maxage=60, stale-while-revalidate=60";

/**
 * 公開店舗一覧を匿名で返し、共有CDNで短時間Cacheします。
 * @param {Request} request - localeを含む公開一覧リクエスト。
 * @returns {Promise<Response>} 公開店舗一覧、または入力エラー。
 */
export async function GET(request: Request) {
  const query = parsePublicPubsQuery(request.url);
  if (!query.ok) return Response.json({ error: query.error }, { status: 400 });

  return Response.json(
    { pubs: await getPublishedPubs(query.locale ?? DEFAULT_LOCALE) },
    { headers: { "Cache-Control": query.locale === null ? "no-store" : PUBLIC_CACHE_CONTROL } },
  );
}
