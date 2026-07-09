import pubs from "../../../../../data/pubs.json";
import { asPubs } from "@irishpub-map/shared/pub";

const API_KEY_HEADER = "x-api-key";

export function GET(request: Request) {
  const apiKey = process.env.IRISHPUB_MAP_API_KEY;

  if (apiKey && request.headers.get(API_KEY_HEADER) !== apiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ pubs: asPubs(pubs) });
}
