import { getPublishedPubs } from "../../lib/pub-repository";
import { DEFAULT_LOCALE, isSupportedLocale } from "../../lib/i18n";

const PUBLIC_CACHE_CONTROL = "public, max-age=0, s-maxage=60, stale-while-revalidate=60";

/**
 * 公開店舗一覧を匿名で返し、共有CDNで短時間Cacheします。
 * @param {Request} request - localeを含む公開一覧リクエスト。
 * @returns {Promise<Response>} 公開店舗一覧、または入力エラー。
 */
export async function GET(request: Request) {
  const requestUrl = request.url;
  const queryStart = requestUrl.indexOf("?");
  const search = queryStart < 0 ? "" : requestUrl.slice(queryStart);
  const locale = search === "" ? null : (/^\?locale=([^&%+]+)$/.exec(search)?.[1] ?? null);
  if (search !== "" && locale === null) {
    return Response.json({ error: "Unsupported query parameter." }, { status: 400 });
  }

  if (locale !== null && !isSupportedLocale(locale)) {
    return Response.json({ error: "Unsupported locale." }, { status: 400 });
  }

  return Response.json(
    { pubs: await getPublishedPubs(locale ?? DEFAULT_LOCALE) },
    { headers: { "Cache-Control": PUBLIC_CACHE_CONTROL } },
  );
}
