import * as Location from "expo-location";
import type { Coordinates } from "@irishpub-map/shared";

const DEFAULT_LOCATION_TIMEOUT_MS = 15_000;

export type CurrentLocationResult =
  | { status: "success"; coordinates: Coordinates }
  | { status: "permission-denied"; canAskAgain: boolean }
  | { status: "services-disabled" }
  | { status: "timeout" }
  | { status: "error" };

/** User操作後だけforeground権限を確認し、1回分の座標をTimeout付きで取得します。
 * @param timeoutMs 位置取得の最大待機時間（ミリ秒）
 * @returns 取得座標、Permission / Location Service状態、または取得結果
 */
export async function getCurrentLocation(timeoutMs = DEFAULT_LOCATION_TIMEOUT_MS): Promise<CurrentLocationResult> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) return { status: "permission-denied", canAskAgain: permission.canAskAgain };
    if (!(await Location.hasServicesEnabledAsync())) return { status: "services-disabled" };

    const position = await getCurrentPositionWithTimeout(timeoutMs);
    const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    if (!isValidCoordinates(coordinates)) return { status: "error" };

    return { status: "success", coordinates };
  } catch (error) {
    return error instanceof LocationTimeoutError ? { status: "timeout" } : { status: "error" };
  }
}

function getCurrentPositionWithTimeout(timeoutMs: number) {
  return new Promise<Location.LocationObject>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new LocationTimeoutError()), timeoutMs);
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(
      (position) => {
        clearTimeout(timeout);
        resolve(position);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

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

class LocationTimeoutError extends Error {
  constructor() {
    super("Location request timed out.");
    this.name = "LocationTimeoutError";
  }
}
