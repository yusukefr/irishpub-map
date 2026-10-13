import { NextResponse, type NextRequest } from "next/server";
import { parsePublicPubsQuery } from "./app/lib/public-pubs-query";

/**
 * Cache lookup前に公開店舗APIの元Query文字列を検証します。
 * @param {NextRequest} request - 公開店舗APIリクエスト。
 * @returns {Response} 続行、または入力エラー。
 */
export function proxy(request: NextRequest) {
  const query = parsePublicPubsQuery(request.url);
  if (!query.ok) return Response.json({ error: query.error }, { status: 400 });

  return NextResponse.next();
}

export const config = {
  matcher: "/api/pubs",
};
