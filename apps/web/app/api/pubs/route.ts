import { getValidatedPubs } from "../../lib/pub-data";

const API_KEY_HEADER = "x-api-key";

export function GET(request: Request) {
  const apiKey = process.env.IRISHPUB_MAP_API_KEY;

  if (apiKey && request.headers.get(API_KEY_HEADER) !== apiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({ pubs: getValidatedPubs() });
}
