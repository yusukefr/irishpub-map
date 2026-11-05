import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Location from "expo-location";
import { getCurrentLocation } from "../../apps/mobile/lib/current-location";

const locationMock = vi.hoisted(() => ({
  getForegroundPermissionsAsync: vi.fn(),
  requestForegroundPermissionsAsync: vi.fn(),
  hasServicesEnabledAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
}));

vi.mock("expo-location", () => ({
  ...locationMock,
  Accuracy: { Balanced: 3 },
}));

describe("getCurrentLocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationMock.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    locationMock.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    locationMock.hasServicesEnabledAsync.mockResolvedValue(true);
    locationMock.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 35.68, longitude: 139.76 } });
  });

  it("asks permission only when explicitly called and then gets one position", async () => {
    await expect(getCurrentLocation()).resolves.toEqual({
      status: "success",
      coordinates: { latitude: 35.68, longitude: 139.76 },
    });
    expect(locationMock.requestForegroundPermissionsAsync).toHaveBeenCalledOnce();
    expect(locationMock.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced });
  });

  it("reports retryable and blocked denials without requesting a position", async () => {
    locationMock.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    await expect(getCurrentLocation()).resolves.toEqual({ status: "permission-denied", canAskAgain: true });
    expect(locationMock.getCurrentPositionAsync).not.toHaveBeenCalled();

    locationMock.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    await expect(getCurrentLocation()).resolves.toEqual({ status: "permission-denied", canAskAgain: false });
    expect(locationMock.requestForegroundPermissionsAsync).toHaveBeenCalledOnce();
  });

  it("stops when location services are disabled and rejects invalid coordinates", async () => {
    locationMock.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    locationMock.hasServicesEnabledAsync.mockResolvedValue(false);
    await expect(getCurrentLocation()).resolves.toEqual({ status: "services-disabled" });
    expect(locationMock.getCurrentPositionAsync).not.toHaveBeenCalled();

    locationMock.hasServicesEnabledAsync.mockResolvedValue(true);
    locationMock.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 91, longitude: 0 } });
    await expect(getCurrentLocation()).resolves.toEqual({ status: "error" });
  });
});
