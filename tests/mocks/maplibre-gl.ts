// 実際のWebGLを使わず、MapLibreへの命令と失敗経路を観測するモックです。
import { vi } from "vitest";

export const maplibreMock = {
  mapRemove: vi.fn(),
  mapAddControl: vi.fn(),
  mapOn: vi.fn(),
  mapOff: vi.fn(),
  mapFitBounds: vi.fn(),
  mapJumpTo: vi.fn(),
  setWorkerUrl: vi.fn(),
  mapGetLayer: vi.fn().mockReturnValue({}),
  mapSetLayoutProperty: vi.fn(),
  mapIsStyleLoaded: vi.fn().mockReturnValue(false),
  markerConstructor: vi.fn(),
  markerSetLngLat: vi.fn(),
  markerSetPopup: vi.fn(),
  markerAddTo: vi.fn(),
  markerRemove: vi.fn(),
  popupConstructor: vi.fn(),
  popupSetLngLat: vi.fn(),
  popupSetHTML: vi.fn(),
  popupSetDOMContent: vi.fn(),
  popupSetMaxWidth: vi.fn(),
  popupAddTo: vi.fn(),
  popupIsOpen: vi.fn(),
  popupRemove: vi.fn(),
  popupOn: vi.fn(),
  popupOff: vi.fn(),
  navigationControl: vi.fn(),
  mapConstructor: vi.fn(),
  shouldThrowMapConstructor: false,
};

const mapEventListeners = new globalThis.Map<string, (...args: unknown[]) => void>();

/** テスト間でMapLibreの呼び出し履歴と失敗フラグを初期化します。 */
export function resetMaplibreMock() {
  maplibreMock.shouldThrowMapConstructor = false;
  maplibreMock.mapRemove.mockClear();
  maplibreMock.markerConstructor.mockClear();
  maplibreMock.mapAddControl.mockClear();
  maplibreMock.mapOn.mockClear();
  maplibreMock.mapOff.mockClear();
  maplibreMock.mapFitBounds.mockClear();
  maplibreMock.mapJumpTo.mockClear();
  maplibreMock.setWorkerUrl.mockClear();
  maplibreMock.mapGetLayer.mockClear();
  maplibreMock.mapSetLayoutProperty.mockClear();
  maplibreMock.mapIsStyleLoaded.mockReset();
  maplibreMock.mapIsStyleLoaded.mockReturnValue(false);
  maplibreMock.markerSetLngLat.mockClear();
  maplibreMock.markerSetPopup.mockClear();
  maplibreMock.markerAddTo.mockClear();
  maplibreMock.markerRemove.mockClear();
  maplibreMock.popupConstructor.mockClear();
  maplibreMock.popupSetLngLat.mockClear();
  maplibreMock.popupSetHTML.mockClear();
  maplibreMock.popupSetDOMContent.mockClear();
  maplibreMock.popupSetMaxWidth.mockClear();
  maplibreMock.popupAddTo.mockClear();
  maplibreMock.popupIsOpen.mockClear();
  maplibreMock.popupRemove.mockClear();
  maplibreMock.popupOn.mockClear();
  maplibreMock.popupOff.mockClear();
  maplibreMock.navigationControl.mockClear();
  maplibreMock.mapConstructor.mockClear();
  mapEventListeners.clear();
}

/** MapLibreのイベントを発火し、ロード完了や通信エラーを再現します。 */
export function emitMapEvent(type: string, ...args: unknown[]) {
  mapEventListeners.get(type)?.(...args);
}

export class Map {
  constructor(options: unknown) {
    maplibreMock.mapConstructor(options);

    if (maplibreMock.shouldThrowMapConstructor) {
      throw new Error("WebGL failed");
    }
  }

  addControl = maplibreMock.mapAddControl;
  on = (type: string, listener: (...args: unknown[]) => void) => {
    maplibreMock.mapOn(type, listener);
    mapEventListeners.set(type, listener);
    return this;
  };
  off = (type: string, listener: (...args: unknown[]) => void) => {
    maplibreMock.mapOff(type, listener);
    if (mapEventListeners.get(type) === listener) {
      mapEventListeners.delete(type);
    }
    return this;
  };
  fitBounds = maplibreMock.mapFitBounds;
  jumpTo = maplibreMock.mapJumpTo;
  getLayer = maplibreMock.mapGetLayer;
  setLayoutProperty = maplibreMock.mapSetLayoutProperty;
  isStyleLoaded = maplibreMock.mapIsStyleLoaded;
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
  private open = false;
  private map: Map | null = null;
  private readonly closeOnClick: boolean;
  private readonly closeListeners = new Set<() => void>();
  private readonly handleMapClick = () => this.remove();

  constructor(options?: { closeOnClick?: boolean }) {
    maplibreMock.popupConstructor(options);
    this.closeOnClick = options?.closeOnClick ?? true;
  }

  setLngLat(lngLat: unknown) {
    maplibreMock.popupSetLngLat(lngLat);
    return this;
  }

  setHTML(html: string) {
    maplibreMock.popupSetHTML(html);
    return this;
  }

  setDOMContent(content: Node) {
    maplibreMock.popupSetDOMContent(content);
    return this;
  }

  setMaxWidth(maxWidth: string) {
    maplibreMock.popupSetMaxWidth(maxWidth);
    return this;
  }

  addTo(map: Map) {
    maplibreMock.popupAddTo(map);
    this.map = map;
    this.open = true;
    if (this.closeOnClick) {
      map.on("click", this.handleMapClick);
    }
    return this;
  }

  isOpen() {
    maplibreMock.popupIsOpen();
    return this.open;
  }

  on(type: string, listener: () => void) {
    maplibreMock.popupOn(type, listener);
    if (type === "close") {
      this.closeListeners.add(listener);
    }
    return this;
  }

  off(type: string, listener: () => void) {
    maplibreMock.popupOff(type, listener);
    if (type === "close") {
      this.closeListeners.delete(listener);
    }
    return this;
  }

  remove = () => {
    if (!this.open) {
      return this;
    }
    if (this.closeOnClick) {
      this.map?.off("click", this.handleMapClick);
    }
    this.map = null;
    maplibreMock.popupRemove();
    this.open = false;
    this.closeListeners.forEach((listener) => listener());
    return this;
  };
}

export const NavigationControl = maplibreMock.navigationControl;
export const setWorkerUrl = maplibreMock.setWorkerUrl;
