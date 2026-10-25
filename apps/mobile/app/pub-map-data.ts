import type { Feature, FeatureCollection, Point } from "geojson";
import type { Pub } from "@irishpub-map/shared";

/** MapLibreへ渡すため、利用可能な座標をPub ID付きのPointへ変換します。 */
export function toPubFeatureCollection(pubs: Pub[]): FeatureCollection<Point, { pubId: string }> {
  const features: Feature<Point, { pubId: string }>[] = pubs
    .filter(
      ({ latitude, longitude }) =>
        Number.isFinite(latitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        Number.isFinite(longitude) &&
        longitude >= -180 &&
        longitude <= 180,
    )
    .map((pub) => ({
      type: "Feature",
      id: pub.id,
      properties: { pubId: pub.id },
      geometry: { type: "Point", coordinates: [pub.longitude, pub.latitude] },
    }));

  return { type: "FeatureCollection", features };
}
