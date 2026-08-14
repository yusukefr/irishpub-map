// 実際のWebGLを使わず、MapLibreへの命令と失敗経路を観測するモックです。
import { vi } from "vitest";

export const maplibreMock = {
  mapRemove: vi.fn(),
  mapAddControl: vi.fn(),
  mapFitBounds: vi.fn(),
  mapJumpTo: vi.fn(),
  markerConstructor: vi.fn(),
  markerSetLngLat: vi.fn(),
  markerSetPopup: vi.fn(),
  markerAddTo: vi.fn(),
  markerRemove: vi.fn(),
  popupSetHTML: vi.fn(),
  popupSetDOMContent: vi.fn(),
  navigationControl: vi.fn(),
  mapConstructor: vi.fn(),
  shouldThrowMapConstructor: false,
};

/** テスト間でMapLibreの呼び出し履歴と失敗フラグを初期化します。 */
export function resetMaplibreMock() {
  maplibreMock.shouldThrowMapConstructor = false;
  maplibreMock.mapRemove.mockClear();
  maplibreMock.markerConstructor.mockClear();
  maplibreMock.mapAddControl.mockClear();
  maplibreMock.mapFitBounds.mockClear();
  maplibreMock.mapJumpTo.mockClear();
  maplibreMock.markerSetLngLat.mockClear();
  maplibreMock.markerSetPopup.mockClear();
  maplibreMock.markerAddTo.mockClear();
  maplibreMock.markerRemove.mockClear();
  maplibreMock.popupSetHTML.mockClear();
  maplibreMock.popupSetDOMContent.mockClear();
  maplibreMock.navigationControl.mockClear();
  maplibreMock.mapConstructor.mockClear();
}

export class Map {
  constructor(options: unknown) {
    maplibreMock.mapConstructor(options);

    if (maplibreMock.shouldThrowMapConstructor) {
      throw new Error("WebGL failed");
    }
  }

  addControl = maplibreMock.mapAddControl;
  fitBounds = maplibreMock.mapFitBounds;
  jumpTo = maplibreMock.mapJumpTo;
  remove = maplibreMock.mapRemove;
}

export class Marker {
  constructor(options: unknown) {
    maplibreMock.markerConstructor(options);
  }

  setLngLat = maplibreMock.markerSetLngLat.mockReturnThis();
  setPopup = maplibreMock.markerSetPopup.mockReturnThis();
  addTo = maplibreMock.markerAddTo.mockReturnThis();
  remove = maplibreMock.markerRemove.mockReturnThis();
}

export class Popup {
  setHTML = maplibreMock.popupSetHTML.mockReturnThis();
  setDOMContent = maplibreMock.popupSetDOMContent.mockReturnThis();
}

export const NavigationControl = maplibreMock.navigationControl;
