import { getPubs } from "../../lib/pub-repository";

const API_KEY_HEADER = "x-api-key";

/** 公開店舗一覧を返し、Production では API キー設定とリクエスト認証を必須にします。 */
export async function GET(request: Request) {
  const apiKey = process.env.IRISHPUB_MAP_API_KEY?.trim();

  if (process.env.VERCEL_ENV === "production" && !apiKey) {
    return Response.json({ error: "API authentication is not configured." }, { status: 503 });
  }

  if (apiKey && request.headers.get(API_KEY_HEADER) !== apiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ pubs: await getPubs() });
}
