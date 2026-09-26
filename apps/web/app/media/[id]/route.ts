import { isMediaAssetId } from "@irishpub-map/shared/media";
import { isE2ETestMode } from "../../lib/e2e-test-mode";
import { getMediaAsset, isMediaDatabaseConfigured } from "../../lib/media/repository";

export const runtime = "nodejs";

/**
 * 本文Markdownで使う安定したMedia URLを、許可済みの画像配信先へ解決します。
 * @param {Request} request - 画像リクエスト。
 * @param {object} context - Route context。
 * @param {Promise<{ id: string }>} context.params - Media Asset ID。
 * @returns {Promise<Response>} 一時redirect、404、またはDB利用不可の503。
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await context.params;
  if (!isMediaAssetId(id)) return new Response(null, { status: 404 });
  if (!isMediaDatabaseConfigured() && !isE2ETestMode()) return new Response(null, { status: 503 });

  try {
    const media = await getMediaAsset(id);
    if (!media) return new Response(null, { status: 404 });
    const target = getAllowedMediaTarget(media.url, request.url);
    if (!target) return new Response(null, { status: 404 });
    return new Response(null, {
      status: 307,
      headers: { Location: target.toString(), "Cache-Control": "public, max-age=300, s-maxage=300" },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}

function getAllowedMediaTarget(value: string, requestUrl: string): URL | null {
  if (isE2ETestMode() && /^\/media-fixtures\/[a-z0-9-]+\.(?:jpg|png|webp)$/.test(value)) {
    return new URL(value, requestUrl);
  }
  try {
    const target = new URL(value);
    return target.protocol === "https:" && target.hostname.endsWith(".public.blob.vercel-storage.com") ? target : null;
  } catch {
    return null;
  }
}
