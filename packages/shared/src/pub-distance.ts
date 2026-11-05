import type { Pub } from "./pub";
import type { Coordinates } from "./pub-search";

const EARTH_MEAN_RADIUS_KM = 6371.0088;

/** 緯度経度の組が地球上の座標範囲に入るか確認します。 */
function isValidCoordinates(coordinates: Coordinates) {
  return (
    Number.isFinite(coordinates.latitude) &&
    coordinates.latitude >= -90 &&
    coordinates.latitude <= 90 &&
    Number.isFinite(coordinates.longitude) &&
    coordinates.longitude >= -180 &&
    coordinates.longitude <= 180
  );
}

/** 2点間の大円距離をkmで計算します。
 * @param origin 距離計算の基点
 * @param destination 距離計算の終点
 * @returns 球面上の距離（km）
 */
export function calculateDistanceKm(origin: Coordinates, destination: Coordinates): number {
  if (!isValidCoordinates(origin) || !isValidCoordinates(destination)) {
    throw new RangeError("Coordinates must be finite latitude and longitude values.");
  }

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const centralAngle = 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));

  return EARTH_MEAN_RADIUS_KM * centralAngle;
}

/** 現在地からの距離が近い順にPubを返します。
 * @param pubs 距離順に並べるPub
 * @param origin 距離計算の基点
 * @returns Pubと距離の組を近い順に返します
 */
export function sortPubsByDistance(pubs: Pub[], origin: Coordinates) {
  return pubs
    .map((pub) => ({ pub, distanceKm: calculateDistanceKm(origin, pub) }))
    .sort(
      (left, right) =>
        left.distanceKm - right.distanceKm ||
        left.pub.name.localeCompare(right.pub.name, "ja") ||
        left.pub.id.localeCompare(right.pub.id),
    );
}
