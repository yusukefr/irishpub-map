import { getPublishedPubs } from "../../lib/pub-repository";
import { DEFAULT_LOCALE, isSupportedLocale } from "../../lib/i18n";

const PUBLIC_CACHE_CONTROL = "public, max-age=0, s-maxage=60, stale-while-revalidate=300";

/**
 * 公開店舗一覧を匿名で返し、共有CDNで短時間Cacheします。
 * @param {Request} request - localeを含む公開一覧リクエスト。
 * @returns {Promise<Response>} 公開店舗一覧、または入力エラー。
 */
export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("locale");
  if (locale !== null && !isSupportedLocale(locale)) {
    return Response.json({ error: "Unsupported locale." }, { status: 400 });
  }

  return Response.json(
    { pubs: await getPublishedPubs(locale ?? DEFAULT_LOCALE) },
    { headers: { "Cache-Control": PUBLIC_CACHE_CONTROL } },
  );
}
