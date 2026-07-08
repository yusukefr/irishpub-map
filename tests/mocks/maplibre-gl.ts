import { vi } from "vitest";

export const maplibreMock = {
  mapRemove: vi.fn(),
  mapAddControl: vi.fn(),
  mapJumpTo: vi.fn(),
  markerConstructor: vi.fn(),
  markerSetLngLat: vi.fn(),
  markerSetPopup: vi.fn(),
  markerAddTo: vi.fn(),
  popupSetHTML: vi.fn(),
  popupSetDOMContent: vi.fn(),
  navigationControl: vi.fn(),
  mapConstructor: vi.fn(),
  shouldThrowMapConstructor: false
};

export function resetMaplibreMock() {
  maplibreMock.shouldThrowMapConstructor = false;
  maplibreMock.mapRemove.mockClear();
  maplibreMock.markerConstructor.mockClear();
  maplibreMock.mapAddControl.mockClear();
  maplibreMock.mapJumpTo.mockClear();
  maplibreMock.markerSetLngLat.mockClear();
  maplibreMock.markerSetPopup.mockClear();
  maplibreMock.markerAddTo.mockClear();
  maplibreMock.popupSetHTML.mockClear();
  maplibreMock.popupSetDOMContent.mockClear();
  maplibreMock.navigationControl.mockClear();
  maplibreMock.mapConstructor.mockClear();
}

class MapMock {
  constructor(options: unknown) {
    maplibreMock.mapConstructor(options);

    if (maplibreMock.shouldThrowMapConstructor) {
      throw new Error("WebGL failed");
    }
  }

  addControl = maplibreMock.mapAddControl;
  jumpTo = maplibreMock.mapJumpTo;
  remove = maplibreMock.mapRemove;
}

class MarkerMock {
  constructor(options: unknown) {
    maplibreMock.markerConstructor(options);
  }

  setLngLat = maplibreMock.markerSetLngLat.mockReturnThis();
  setPopup = maplibreMock.markerSetPopup.mockReturnThis();
  addTo = maplibreMock.markerAddTo.mockReturnThis();
}

class PopupMock {
  setHTML = maplibreMock.popupSetHTML.mockReturnThis();
  setDOMContent = maplibreMock.popupSetDOMContent.mockReturnThis();
}

const maplibregl = {
  Map: MapMock,
  Marker: MarkerMock,
  Popup: PopupMock,
  NavigationControl: maplibreMock.navigationControl
};

export default maplibregl;
