import { getPublishedPubs } from "../../lib/pub-repository";
import { DEFAULT_LOCALE, isSupportedLocale } from "../../lib/i18n";

const API_KEY_HEADER = "x-api-key";

/**
/**
 * 公開店舗一覧を返し、Production では API キー設定とリクエスト認証を必須にします。
 * @param {Request} request - APIキー確認対象のリクエスト。
 * @returns {Promise<Response>} 公開店舗一覧、または認証エラー。
 */
export async function GET(request: Request) {
  const apiKey = process.env.IRISHPUB_MAP_API_KEY?.trim();

  if (process.env.VERCEL_ENV === "production" && !apiKey) {
    return Response.json({ error: "API authentication is not configured." }, { status: 503 });
  }

  if (apiKey && request.headers.get(API_KEY_HEADER) !== apiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = new URL(request.url).searchParams.get("locale");
  if (locale !== null && !isSupportedLocale(locale)) {
    return Response.json({ error: "Unsupported locale." }, { status: 400 });
  }

  return Response.json({ pubs: await getPublishedPubs(locale ?? DEFAULT_LOCALE) });
}
